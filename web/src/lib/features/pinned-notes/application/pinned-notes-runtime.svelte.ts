import { Pinlist } from 'nostr-tools/kinds';
import type { Event } from 'nostr-tools';
import type { EventTemplate } from 'nostr-tools';
import { auth } from '$lib/auth.svelte';
import { cacheAccountEvent } from '$lib/cache/Events';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import { fetchLatestReplaceableEvent, publishEvent } from '$lib/nostr/relay/event-operations';
import { getRelayHint } from '$lib/nostr/relay/relay-hints';
import { assertSignedEventPubkey } from '$lib/nostr/signing/assert-signed-event-pubkey';
import { applyPinOperations, pinnedEventIds, type PinOperation } from '../domain/pin-list';

export type PinSaveFailure = {
	stage: 'fetching' | 'signing' | 'publishing';
	error: unknown;
	revision: number;
};
type Phase = 'idle' | 'fetching' | 'signing' | 'publishing';
type Dependencies = {
	fetchLatest(owner: string): Promise<Event | undefined>;
	sign(template: EventTemplate): Promise<Event>;
	publish(event: Event): Promise<void>;
	cache(event: Event): Promise<boolean>;
	now(): number;
	getRelayHint(eventId: string): string | undefined;
};

const defaultDependencies: Dependencies = {
	fetchLatest: (owner) => fetchLatestReplaceableEvent(Pinlist, owner),
	sign: (template) => {
		const signer = auth.signer;
		if (signer === undefined) throw new Error('Signing is unavailable');
		return signer.signEvent(template);
	},
	publish: publishEvent,
	cache: (event) => cacheAccountEvent(event),
	now: () => Math.floor(Date.now() / 1000),
	getRelayHint
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

	pin(note: Pick<Event, 'id' | 'pubkey'>): void {
		this.#enqueue({
			type: 'pin',
			eventId: note.id,
			authorPubkey: note.pubkey,
			relayHint: this.dependencies.getRelayHint(note.id)
		});
	}

	unpin(eventId: string): void {
		this.#enqueue({ type: 'unpin', eventId });
	}

	#enqueue(operation: PinOperation): void {
		if (this.#owner === undefined) throw new Error('Pinned notes account is not initialized');
		this.#failure = undefined;
		if (this.#phase !== 'idle') {
			this.#pending = [...this.#pending, operation];
			return;
		}
		this.#inFlight = [operation];
		this.#phase = 'fetching';
		void this.#save(this.#owner, this.#generation);
	}

	async #save(owner: string, generation: number): Promise<void> {
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
				fetched !== undefined && shouldReplaceCurrentEvent(fetched, this.#canonical)
					? fetched
					: this.#canonical;
			this.#canonical = base;
			this.#phase = 'signing';

			let event: Event;
			try {
				const created_at = Math.max(
					this.dependencies.now(),
					(base?.created_at ?? -1) + 1,
					(this.#lastSignedAt ?? -1) + 1
				);
				event = await this.dependencies.sign({
					kind: Pinlist,
					created_at,
					tags: applyPinOperations(base?.tags ?? [], this.#inFlight),
					content: base?.content ?? ''
				});
				if (!current()) return;
				assertSignedEventPubkey(event, owner);
				this.#lastSignedAt = event.created_at;
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
