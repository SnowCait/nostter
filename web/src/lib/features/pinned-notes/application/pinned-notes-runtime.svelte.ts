import { Pinlist } from 'nostr-tools/kinds';
import type { Event } from 'nostr-tools';
import { filter, firstValueFrom } from 'rxjs';
import { cacheAccountEvent } from '$lib/cache/Events';
import { assertSignedEventPubkey } from '$lib/nostr/signing/assert-signed-event-pubkey';
import type { Signer } from '$lib/nostr/signing/signer';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { applyPinOperations, pinnedEventIds, type PinOperation } from '../domain/pin-list';

export type PinSaveFailure = { stage: 'signing' | 'publishing'; error: unknown; revision: number };
type Phase = 'idle' | 'signing' | 'publishing';
type Dependencies = {
	publish(event: Event): Promise<void>;
	cache(event: Event): Promise<unknown>;
	now(): number;
	wait(milliseconds: number): Promise<void>;
};

const defaultDependencies: Dependencies = {
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
		this.#phase = 'signing';
		void this.#save(this.#owner, this.#generation, signEvent);
	}

	async #save(owner: string, generation: number, signEvent: Signer['signEvent']): Promise<void> {
		const current = () => this.#owner === owner && this.#generation === generation;
		let retry = false;
		while (current()) {
			let event: Event;
			try {
				const canonicalAt = this.#canonical?.created_at;
				while (current()) {
					const now = this.dependencies.now();
					if (canonicalAt !== undefined && canonicalAt > now)
						throw new Error('Pinned notes canonical event is in the future');
					if (now > Math.max(canonicalAt ?? -1, this.#lastSignedAt ?? -1)) break;
					await this.dependencies.wait(1000);
				}
				if (!current()) return;
				const created_at = this.dependencies.now();
				if (canonicalAt !== undefined && canonicalAt > created_at)
					throw new Error('Pinned notes canonical event is in the future');
				if (created_at <= Math.max(canonicalAt ?? -1, this.#lastSignedAt ?? -1)) continue;
				this.#lastSignedAt = created_at;
				event = await signEvent({
					kind: Pinlist,
					created_at,
					tags: applyPinOperations(this.#canonical?.tags ?? [], this.#inFlight),
					content: this.#canonical?.content ?? ''
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
				if (!retry && this.#pending.length > 0) {
					this.#inFlight = [...this.#inFlight, ...this.#pending];
					this.#pending = [];
					this.#phase = 'signing';
					retry = true;
					continue;
				}
				this.#fail('publishing', error);
				return;
			}
			if (!current()) return;
			try {
				await this.dependencies.cache(event);
			} catch (error) {
				if (current()) this.#fail('publishing', error);
				return;
			}
			if (!current()) return;
			this.#canonical = event;
			this.#inFlight = this.#pending;
			this.#pending = [];
			if (this.#inFlight.length === 0) {
				this.#phase = 'idle';
				return;
			}
			this.#phase = 'signing';
			retry = false;
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
