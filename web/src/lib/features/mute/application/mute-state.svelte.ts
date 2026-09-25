import type { Event } from 'nostr-tools';
import type { ListContentDecrypter } from '$lib/List';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import {
	getKindMuteTarget,
	prepareMuteTags,
	prepareRegularMuteState,
	type KindMuteState,
	type RegularMuteState
} from '../domain/mute-state';
import {
	prepareKindMuteStateFromEvent,
	prepareRegularMuteStateFromEvent
} from './prepare-mute-state';

export type MuteState = {
	readonly accountPubkey: string | undefined;
	readonly regular: RegularMuteState;
	readonly byKind: ReadonlyMap<number, KindMuteState>;
};

export type MuteSnapshot = Pick<MuteState, 'regular' | 'byKind'>;

export type MuteInitializationBaseline = {
	readonly ownerToken: object;
	readonly regular: RegularMuteState;
	readonly byKind: ReadonlyMap<number, KindMuteState>;
};

function emptyState(): MuteState {
	return {
		accountPubkey: undefined,
		regular: prepareRegularMuteState(undefined, ''),
		byKind: new Map()
	};
}

export class Mute {
	#state = $state.raw<MuteState>(emptyState());
	#ownerToken: object = {};
	#pendingRegular: Event | undefined;
	#pendingByKind = new Map<number, Event>();
	#listeners = new Set<() => void>();

	get state(): MuteState {
		return this.#state;
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	#publish(state: MuteState): void {
		this.#state = state;
		for (const listener of this.#listeners) listener();
	}

	captureInitializationBaseline(): MuteInitializationBaseline {
		return {
			ownerToken: this.#ownerToken,
			regular: this.#state.regular,
			byKind: new Map(this.#state.byKind)
		};
	}

	reset(): void {
		this.#ownerToken = {};
		this.#pendingRegular = undefined;
		this.#pendingByKind.clear();
		this.#publish(emptyState());
	}

	applySnapshot(
		accountPubkey: string,
		snapshot: MuteSnapshot,
		baseline: MuteInitializationBaseline
	): void {
		if (this.#ownerToken !== baseline.ownerToken) return;

		if (this.#state.accountPubkey !== accountPubkey) {
			this.#ownerToken = {};
			this.#pendingRegular = undefined;
			this.#pendingByKind.clear();
			this.#publish({
				accountPubkey,
				regular: snapshot.regular,
				byKind: new Map(snapshot.byKind)
			});
			return;
		}

		let regular = this.#state.regular;
		const snapshotEvent = snapshot.regular.event;
		const pendingRegular = this.#pendingRegular;
		if (
			regular === baseline.regular &&
			snapshotEvent !== undefined &&
			(regular.event === undefined ||
				shouldReplaceCurrentEvent(snapshotEvent, regular.event)) &&
			(pendingRegular === undefined ||
				shouldReplaceCurrentEvent(snapshotEvent, pendingRegular))
		) {
			regular = snapshot.regular;
			this.#pendingRegular = undefined;
		}

		const byKind = new Map(this.#state.byKind);
		for (const [kind, candidate] of snapshot.byKind) {
			const current = this.#state.byKind.get(kind);
			const pending = this.#pendingByKind.get(kind);
			if (
				current !== baseline.byKind.get(kind) ||
				(pending !== undefined && !shouldReplaceCurrentEvent(candidate.event, pending)) ||
				(current !== undefined &&
					!shouldReplaceCurrentEvent(candidate.event, current.event))
			) {
				continue;
			}
			this.#pendingByKind.delete(kind);
			byKind.set(kind, candidate);
		}
		if (
			regular !== this.#state.regular ||
			[...byKind].some(([kind, value]) => this.#state.byKind.get(kind) !== value)
		) {
			this.#publish({ ...this.#state, regular, byKind });
		}
	}

	async ingestRegularEvent(
		accountPubkey: string,
		event: Event,
		decryptPrivateListContent?: ListContentDecrypter
	): Promise<void> {
		if (this.#state.accountPubkey !== accountPubkey || event.pubkey !== accountPubkey) return;
		const baseline = this.#state.regular;
		if (baseline.event !== undefined && !shouldReplaceCurrentEvent(event, baseline.event))
			return;
		if (
			this.#pendingRegular !== undefined &&
			!shouldReplaceCurrentEvent(event, this.#pendingRegular)
		)
			return;
		this.#pendingRegular = event;
		let prepared: RegularMuteState;
		try {
			prepared = await prepareRegularMuteStateFromEvent(
				event,
				accountPubkey,
				decryptPrivateListContent
			);
		} catch (error) {
			if (this.#pendingRegular === event) this.#pendingRegular = undefined;
			throw error;
		}
		if (this.#pendingRegular !== event) return;
		this.#pendingRegular = undefined;
		if (this.#state.accountPubkey !== accountPubkey || this.#state.regular !== baseline) return;
		this.#publish({ ...this.#state, regular: prepared });
	}

	async ingestKindEvent(
		accountPubkey: string,
		event: Event,
		decryptPrivateListContent?: ListContentDecrypter
	): Promise<void> {
		if (this.#state.accountPubkey !== accountPubkey || event.pubkey !== accountPubkey) return;
		const kind = getKindMuteTarget(event);
		if (kind === undefined) return;
		const baseline = this.#state.byKind.get(kind);
		if (baseline !== undefined && !shouldReplaceCurrentEvent(event, baseline.event)) return;
		const pending = this.#pendingByKind.get(kind);
		if (pending !== undefined && !shouldReplaceCurrentEvent(event, pending)) return;
		this.#pendingByKind.set(kind, event);
		let prepared: KindMuteState | undefined;
		try {
			prepared = await prepareKindMuteStateFromEvent(event, decryptPrivateListContent);
		} catch (error) {
			if (this.#pendingByKind.get(kind) === event) this.#pendingByKind.delete(kind);
			throw error;
		}
		if (this.#pendingByKind.get(kind) !== event) return;
		this.#pendingByKind.delete(kind);
		if (
			prepared === undefined ||
			this.#state.accountPubkey !== accountPubkey ||
			this.#state.byKind.get(kind) !== baseline
		)
			return;
		const byKind = new Map(this.#state.byKind);
		byKind.set(kind, prepared);
		this.#publish({ ...this.#state, byKind });
	}

	replaceRegularTags(
		accountPubkey: string,
		tags: string[][],
		expected?: RegularMuteState
	): RegularMuteState | undefined {
		if (
			this.#state.accountPubkey !== accountPubkey ||
			(expected !== undefined && this.#state.regular !== expected)
		)
			return undefined;
		this.#pendingRegular = undefined;
		const regular = {
			event: this.#state.regular.event,
			tags: prepareMuteTags(tags, accountPubkey)
		};
		this.#publish({ ...this.#state, regular });
		return regular;
	}

	replaceRegularFromLocalEvent(
		accountPubkey: string,
		event: Event,
		privateTags: string[][],
		expected: RegularMuteState
	): void {
		if (this.#state.accountPubkey !== accountPubkey || this.#state.regular !== expected) return;
		this.#pendingRegular = undefined;
		this.#publish({
			...this.#state,
			regular: prepareRegularMuteState(event, accountPubkey, privateTags)
		});
	}

	replaceKind(accountPubkey: string, kind: number, prepared: KindMuteState): void {
		if (this.#state.accountPubkey !== accountPubkey) return;
		this.#pendingByKind.delete(kind);
		const byKind = new Map(this.#state.byKind);
		byKind.set(kind, prepared);
		this.#publish({ ...this.#state, byKind });
	}
}

export const mute = new Mute();
