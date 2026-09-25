import type { Event } from 'nostr-tools';
import type { ListContentDecrypter } from '$lib/List';
import { shouldReplaceCurrentEvent } from '$lib/nostr/protocol/replaceable-event';
import {
	prepareMuteTags,
	prepareRegularMuteState,
	type RegularMuteState
} from '../domain/mute-state';
import { prepareRegularMuteStateFromEvent } from './prepare-mute-state';

export type RegularMuteRuntimeState = {
	readonly accountPubkey: string | undefined;
	readonly regular: RegularMuteState;
};

export type RegularMuteInitializationBaseline = {
	readonly owner: object;
	readonly revision: number;
	readonly pending: Event | undefined;
};

export class RegularMuteRuntime {
	#state = $state.raw<RegularMuteRuntimeState>({
		accountPubkey: undefined,
		regular: prepareRegularMuteState(undefined, '')
	});
	#owner: object = {};
	#revision = 0;
	#pending: Event | undefined;
	#listeners = new Set<() => void>();

	get state(): RegularMuteRuntimeState {
		return this.#state;
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	#publish(state: RegularMuteRuntimeState): void {
		this.#state = state;
		this.#revision++;
		for (const listener of this.#listeners) listener();
	}

	captureInitializationBaseline(): RegularMuteInitializationBaseline {
		return { owner: this.#owner, revision: this.#revision, pending: this.#pending };
	}

	reset(): void {
		this.#owner = {};
		this.#pending = undefined;
		this.#publish({
			accountPubkey: undefined,
			regular: prepareRegularMuteState(undefined, '')
		});
	}

	applySnapshot(
		accountPubkey: string,
		regular: RegularMuteState,
		baseline: RegularMuteInitializationBaseline
	): void {
		if (this.#owner !== baseline.owner) return;
		if (this.#state.accountPubkey !== accountPubkey) {
			this.#owner = {};
			this.#pending = undefined;
			this.#publish({ accountPubkey, regular });
			return;
		}
		if (this.#revision !== baseline.revision || this.#pending !== baseline.pending) return;
		const current = this.#state.regular.event;
		const candidate = regular.event;
		if (
			candidate === undefined ||
			(current !== undefined && !shouldReplaceCurrentEvent(candidate, current))
		)
			return;
		if (this.#pending !== undefined && !shouldReplaceCurrentEvent(candidate, this.#pending))
			return;
		this.#pending = undefined;
		this.#publish({ accountPubkey, regular });
	}

	async ingestEvent(
		accountPubkey: string,
		event: Event,
		decryptPrivateListContent?: ListContentDecrypter
	): Promise<void> {
		if (this.#state.accountPubkey !== accountPubkey || event.pubkey !== accountPubkey) return;
		const current = this.#state.regular.event;
		if (current !== undefined && !shouldReplaceCurrentEvent(event, current)) return;
		if (this.#pending !== undefined && !shouldReplaceCurrentEvent(event, this.#pending)) return;
		const owner = this.#owner;
		const revision = this.#revision;
		this.#pending = event;
		let prepared: RegularMuteState;
		try {
			prepared = await prepareRegularMuteStateFromEvent(
				event,
				accountPubkey,
				decryptPrivateListContent
			);
		} catch (error) {
			if (this.#owner === owner && this.#pending === event) this.#pending = undefined;
			throw error;
		}
		if (this.#owner !== owner || this.#pending !== event || this.#revision !== revision) return;
		this.#pending = undefined;
		this.#publish({ accountPubkey, regular: prepared });
	}

	replaceTags(accountPubkey: string, tags: string[][]): RegularMuteState | undefined {
		if (this.#state.accountPubkey !== accountPubkey) return undefined;
		this.#pending = undefined;
		const regular = {
			event: this.#state.regular.event,
			tags: prepareMuteTags(tags, accountPubkey)
		};
		this.#publish({ accountPubkey, regular });
		return regular;
	}

	restore(accountPubkey: string, previous: RegularMuteState, expected: RegularMuteState): void {
		if (this.#state.accountPubkey !== accountPubkey || this.#state.regular !== expected) return;
		this.#pending = undefined;
		this.#publish({ accountPubkey, regular: previous });
	}

	completeLocalEvent(
		accountPubkey: string,
		event: Event,
		privateTags: string[][],
		expected: RegularMuteState
	): void {
		if (this.#state.accountPubkey !== accountPubkey || this.#state.regular !== expected) return;
		this.#pending = undefined;
		this.#publish({
			accountPubkey,
			regular: prepareRegularMuteState(event, accountPubkey, privateTags)
		});
	}
}

export const regularMute = new RegularMuteRuntime();
