import { Pinlist } from 'nostr-tools/kinds';
import type { Event } from 'nostr-tools';
import { filter, firstValueFrom } from 'rxjs';
import { accountAddressableEventCache, cacheAccountEvent } from '$lib/cache/Events';
import { assertSignedEventPubkey } from '$lib/nostr/signing/assert-signed-event-pubkey';
import type { Signer } from '$lib/nostr/signing/signer';
import { rxNostr } from '$lib/timelines/MainTimeline';
import { applyPinOperations, pinnedEventIds, type PinOperation } from '../domain/pin-list';

export type PinSaveFailure = {
	stage: 'signing' | 'publishing' | 'caching' | 'reconciling';
	error: unknown;
	revision: number;
};
type Phase = 'idle' | 'signing' | 'publishing' | 'caching' | 'reconciling';
type Dependencies = {
	publish(event: Event): Promise<void>;
	cache(event: Event): Promise<boolean>;
	getCached(owner: string): Promise<Event | undefined>;
	now(): number;
	wait(milliseconds: number): Promise<void>;
};

const defaultDependencies: Dependencies = {
	publish: async (event) => {
		await firstValueFrom(rxNostr.send(event).pipe(filter(({ ok }) => ok)));
	},
	cache: (event) => cacheAccountEvent(event),
	getCached: (owner) => accountAddressableEventCache.get(owner, Pinlist),
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
	#accepted = $state<Event>();
	#reconciliationRunning = false;

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
	get acceptedEvent(): Event | undefined {
		return this.#accepted;
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
		this.#accepted = undefined;
		this.#reconciliationRunning = false;
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
		this.#accepted = undefined;
		this.#reconciliationRunning = false;
	}

	pin(eventId: string, signEvent: Signer['signEvent']): void {
		this.#enqueue({ type: 'pin', eventId }, signEvent);
	}

	unpin(eventId: string, signEvent: Signer['signEvent']): void {
		this.#enqueue({ type: 'unpin', eventId }, signEvent);
	}

	reconcile(signEvent: Signer['signEvent']): void {
		if (
			this.#phase !== 'reconciling' ||
			this.#accepted === undefined ||
			this.#owner === undefined ||
			this.#reconciliationRunning
		)
			return;
		this.#reconciliationRunning = true;
		const owner = this.#owner;
		const generation = this.#generation;
		void (async () => {
			const next = await this.#completePublished(this.#accepted!, owner, generation, false);
			if (this.#owner !== owner || this.#generation !== generation) return;
			this.#reconciliationRunning = false;
			if (next !== 'stop') void this.#save(owner, generation, signEvent);
		})();
	}

	#enqueue(operation: PinOperation, signEvent: Signer['signEvent']): void {
		if (this.#owner === undefined) throw new Error('Pinned notes account is not initialized');
		if (this.#phase !== 'reconciling') this.#failure = undefined;
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
		let rebased = false;
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
			this.#accepted = event;
			this.#phase = 'caching';
			const next = await this.#completePublished(event, owner, generation, rebased);
			if (next === 'stop') return;
			rebased = next === 'rebase';
			retry = false;
		}
	}

	async #completePublished(
		event: Event,
		owner: string,
		generation: number,
		alreadyRebased: boolean
	): Promise<'continue' | 'rebase' | 'stop'> {
		const current = () => this.#owner === owner && this.#generation === generation;
		let accepted: boolean;
		try {
			accepted = await this.dependencies.cache(event);
		} catch (error) {
			if (current()) this.#pauseReconciliation('caching', error);
			return 'stop';
		}
		if (!current()) return 'stop';
		let winner = event;
		if (!accepted) {
			try {
				const cached = await this.dependencies.getCached(owner);
				if (cached === undefined) throw new Error('Pinned notes cache winner is missing');
				winner = cached;
			} catch (error) {
				if (current()) this.#pauseReconciliation('reconciling', error);
				return 'stop';
			}
		}
		if (!current()) return 'stop';
		this.#canonical = winner;
		if (winner.id !== event.id) {
			// The relay accepted this snapshot, but the cache winner superseded it.
			this.#inFlight = [...this.#inFlight, ...this.#pending];
			this.#pending = [];
			if (alreadyRebased) {
				this.#pauseReconciliation(
					'reconciling',
					new Error('Pinned notes cache winner changed again')
				);
				return 'stop';
			}
			this.#accepted = undefined;
			this.#failure = undefined;
			this.#phase = 'signing';
			return 'rebase';
		}
		this.#accepted = undefined;
		this.#failure = undefined;
		this.#inFlight = this.#pending;
		this.#pending = [];
		this.#phase = this.#inFlight.length === 0 ? 'idle' : 'signing';
		return this.#phase === 'idle' ? 'stop' : 'continue';
	}

	#pauseReconciliation(stage: 'caching' | 'reconciling', error: unknown): void {
		this.#phase = 'reconciling';
		this.#failure = { stage, error, revision: ++this.#failureRevision };
	}

	#fail(stage: PinSaveFailure['stage'], error: unknown): void {
		this.#inFlight = [];
		this.#pending = [];
		this.#phase = 'idle';
		this.#accepted = undefined;
		this.#failure = { stage, error, revision: ++this.#failureRevision };
	}
}

export const pinnedNotes = new PinnedNotesRuntime();
