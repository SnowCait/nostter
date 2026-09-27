import { Pinlist } from 'nostr-tools/kinds';
import type { Event } from 'nostr-tools';
import { createRxOneshotReq, latest } from 'rx-nostr';
import { EmptyError, filter, firstValueFrom, lastValueFrom } from 'rxjs';
import { cacheAccountEvent } from '$lib/cache/Events';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import { assertSignedEventPubkey } from '$lib/nostr/signing/assert-signed-event-pubkey';
import type { Signer } from '$lib/nostr/signing/signer';
import { rxNostr, tie } from '$lib/timelines/MainTimeline';
import { applyPinOperations, pinnedEventIds, type PinOperation } from '../domain/pin-list';

export type PinSaveFailure = {
	stage: 'fetching' | 'signing' | 'publishing';
	error: unknown;
	revision: number;
};
type Phase = 'idle' | 'fetching' | 'signing' | 'publishing';
type Dependencies = {
	fetchLatest(owner: string): Promise<Event | undefined>;
	publish(event: Event): Promise<void>;
	cache(event: Event): Promise<boolean>;
	now(): number;
	wait(milliseconds: number): Promise<void>;
};

export async function fetchLatestPinnedNotes(owner: string): Promise<Event | undefined> {
	const req = createRxOneshotReq({
		filters: [{ kinds: [Pinlist], authors: [owner], limit: 1 }]
	});
	try {
		const { event } = await lastValueFrom(rxNostr.use(req).pipe(tie, latest()));
		return event;
	} catch (error) {
		if (error instanceof EmptyError) return undefined;
		throw error;
	}
}

const defaultDependencies: Dependencies = {
	fetchLatest: fetchLatestPinnedNotes,
	publish: async (event) => {
		await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
	},
	cache: (event) => cacheAccountEvent(event),
	now: () => Math.floor(Date.now() / 1000),
	wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
};

export class PinnedNotesRuntime {
	#owner = $state<string>();
	#canonical = $state<Event>();
	#inFlight = $state<PinOperation[]>([]);
	#pending = $state<PinOperation[]>([]);
	#phase = $state<Phase>('idle');
	#failure = $state<PinSaveFailure>();
	#failureRevision = 0;
	#generation = 0;
	#lastSignedAt: number | undefined;

	constructor(private readonly dependencies: Dependencies = defaultDependencies) {}

	get owner(): string | undefined {
		return this.#owner;
	}
	get canonical(): Event | undefined {
		return this.#canonical;
	}
	get inFlight(): readonly PinOperation[] {
		return this.#inFlight;
	}
	get pending(): readonly PinOperation[] {
		return this.#pending;
	}
	get phase(): Phase {
		return this.#phase;
	}
	get failure(): PinSaveFailure | undefined {
		return this.#failure;
	}
	get effectivePinnedEventIds(): string[] {
		return pinnedEventIds(
			applyPinOperations(this.#canonical?.tags ?? [], [...this.#inFlight, ...this.#pending])
		);
	}
	isPinned(eventId: string): boolean {
		return this.effectivePinnedEventIds.includes(eventId);
	}

	initialize(owner: string, canonical?: Event): void {
		this.#generation++;
		this.#owner = owner;
		this.#canonical = canonical;
		this.#inFlight = [];
		this.#pending = [];
		this.#phase = 'idle';
		this.#failure = undefined;
		this.#lastSignedAt = undefined;
	}

	reset(): void {
		this.#generation++;
		this.#owner = undefined;
		this.#canonical = undefined;
		this.#inFlight = [];
		this.#pending = [];
		this.#phase = 'idle';
		this.#failure = undefined;
		this.#lastSignedAt = undefined;
	}

	pin(eventId: string, signEvent: Signer['signEvent']): void {
		this.#enqueue({ type: 'pin', eventId }, signEvent);
	}

	unpin(eventId: string, signEvent: Signer['signEvent']): void {
		this.#enqueue({ type: 'unpin', eventId }, signEvent);
	}

	#enqueue(operation: PinOperation, signEvent: Signer['signEvent']): void {
		if (this.#owner === undefined) throw new Error('Pinned notes account is not initialized');
		this.#failure = undefined;
		if (this.#phase !== 'idle') {
			this.#pending = [...this.#pending, operation];
			return;
		}
		this.#inFlight = [operation];
		this.#phase = 'fetching';
		void this.#save(this.#owner, this.#generation, signEvent);
	}

	async #save(owner: string, generation: number, signEvent: Signer['signEvent']): Promise<void> {
		const current = () => this.#owner === owner && this.#generation === generation;
		let retriedPublish = false;
		while (current()) {
			let fetched: Event | undefined;
			try {
				fetched = await this.dependencies.fetchLatest(owner);
			} catch (error) {
				if (current()) this.#fail('fetching', error);
				return;
			}
			if (!current()) return;
			const base =
				fetched !== undefined &&
				(this.#canonical === undefined ||
					shouldReplaceCurrentEvent(fetched, this.#canonical))
					? fetched
					: this.#canonical;
			this.#canonical = base;
			this.#phase = 'signing';

			let event: Event;
			try {
				while (current()) {
					const now = this.dependencies.now();
					if (base !== undefined && base.created_at > now)
						throw new Error('Pinned notes canonical event is in the future');
					if (now > Math.max(base?.created_at ?? -1, this.#lastSignedAt ?? -1)) break;
					await this.dependencies.wait(1000);
				}
				if (!current()) return;
				const created_at = this.dependencies.now();
				if (base !== undefined && base.created_at > created_at)
					throw new Error('Pinned notes canonical event is in the future');
				if (created_at <= Math.max(base?.created_at ?? -1, this.#lastSignedAt ?? -1))
					continue;
				this.#lastSignedAt = created_at;
				event = await signEvent({
					kind: Pinlist,
					created_at,
					tags: applyPinOperations(base?.tags ?? [], this.#inFlight),
					content: base?.content ?? ''
				});
				assertSignedEventPubkey(event, owner);
			} catch (error) {
				if (current()) this.#fail('signing', error);
				return;
			}
			if (!current()) return;
			this.#phase = 'publishing';
			try {
				await this.dependencies.publish(event);
			} catch (error) {
				if (!current()) return;
				if (!retriedPublish && this.#pending.length > 0) {
					this.#inFlight = [...this.#inFlight, ...this.#pending];
					this.#pending = [];
					this.#phase = 'fetching';
					retriedPublish = true;
					continue;
				}
				this.#fail('publishing', error);
				return;
			}
			if (!current()) return;
			this.#canonical = event;
			this.#inFlight = this.#pending;
			this.#pending = [];
			this.#phase = this.#inFlight.length === 0 ? 'idle' : 'fetching';
			void (async () => {
				try {
					await this.dependencies.cache(event);
				} catch (error) {
					console.warn('[pinned notes cache update failed]', error);
				}
			})();
			if (this.#phase === 'idle') return;
			retriedPublish = false;
		}
	}

	#fail(stage: PinSaveFailure['stage'], error: unknown): void {
		this.#inFlight = [];
		this.#pending = [];
		this.#phase = 'idle';
		this.#failure = { stage, error, revision: ++this.#failureRevision };
	}
}

export const pinnedNotes = new PinnedNotesRuntime();
