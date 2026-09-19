import { toStore } from 'svelte/store';
import { unique } from './array';

export type AuthState =
	| { status: 'initializing' }
	| { status: 'anonymous' }
	| {
			status: 'authenticated';
			pubkey: string;
			followingPubkeys: string[];
			followees: string[];
	  };

export type AuthStatus = AuthState['status'];

export class Auth {
	#state = $state<AuthState>({ status: 'initializing' });

	get status(): AuthStatus {
		return this.#state.status;
	}

	get pubkey(): string {
		return this.#state.status === 'authenticated' ? this.#state.pubkey : '';
	}

	get followees(): string[] {
		return this.#state.status === 'authenticated' ? this.#state.followees : [];
	}

	get followingPubkeys(): string[] {
		return this.#state.status === 'authenticated' ? this.#state.followingPubkeys : [];
	}

	followeesSet = $derived(new Set(this.followees));

	isInitializing = $derived(this.#state.status === 'initializing');
	isReady = $derived(this.#state.status !== 'initializing');
	isAuthenticated = $derived(this.#state.status === 'authenticated');

	updateFollowingPubkeys(followingPubkeys: string[], accountPubkey: string): void {
		if (this.#state.status !== 'authenticated') {
			return;
		}

		const uniqueFollowingPubkeys = unique(followingPubkeys);
		this.#state = {
			...this.#state,
			followingPubkeys: uniqueFollowingPubkeys,
			followees: unique([...uniqueFollowingPubkeys, accountPubkey])
		};
	}

	establish(pubkey: string, followingPubkeys: string[]): void {
		const uniqueFollowingPubkeys = unique(followingPubkeys);
		this.#state = {
			status: 'authenticated',
			pubkey,
			followingPubkeys: uniqueFollowingPubkeys,
			followees: unique([...uniqueFollowingPubkeys, pubkey])
		};
	}

	reset(): void {
		this.#state = { status: 'anonymous' };
	}
}

export const auth = new Auth();

export const isInitializing = toStore(() => auth.isInitializing);
export const isReady = toStore(() => auth.isReady);
export const isAuthenticated = toStore(() => auth.isAuthenticated);
