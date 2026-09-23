import { unique } from './array';
import type { Signer } from './nostr/signing/signer';

export type LoginMethod = 'NIP-07' | 'NIP-46' | 'nsec' | 'npub';

export type AuthState =
	| { status: 'initializing' }
	| { status: 'anonymous' }
	| {
			status: 'authenticated';
			pubkey: string;
			followingPubkeys: string[];
			loginMethod: LoginMethod;
			signer?: Signer;
	  };

export type AuthStatus = AuthState['status'];

export class Auth {
	#state = $state<AuthState>({ status: 'initializing' });

	get status(): AuthStatus {
		return this.#state.status;
	}

	get pubkey(): string | undefined {
		return this.#state.status === 'authenticated' ? this.#state.pubkey : undefined;
	}

	get followingPubkeys(): string[] {
		return this.#state.status === 'authenticated' ? this.#state.followingPubkeys : [];
	}

	get signer(): Signer | undefined {
		return this.#state.status === 'authenticated' ? this.#state.signer : undefined;
	}

	get loginMethod(): LoginMethod | undefined {
		return this.#state.status === 'authenticated' ? this.#state.loginMethod : undefined;
	}

	#followees = $derived(
		this.#state.status === 'authenticated'
			? unique([...this.#state.followingPubkeys, this.#state.pubkey])
			: []
	);

	get followees(): string[] {
		return this.#followees;
	}

	followeesSet = $derived(new Set(this.#followees));

	isInitializing = $derived(this.#state.status === 'initializing');
	isReady = $derived(this.#state.status !== 'initializing');
	isAuthenticated = $derived(this.#state.status === 'authenticated');

	updateFollowingPubkeys(followingPubkeys: string[]): void {
		if (this.#state.status !== 'authenticated') {
			throw new Error('Cannot update following pubkeys without an authenticated session');
		}

		this.#state = {
			...this.#state,
			followingPubkeys: unique(followingPubkeys)
		};
	}

	establish(session: Omit<Extract<AuthState, { status: 'authenticated' }>, 'status'>): void {
		this.#state = {
			status: 'authenticated',
			...session,
			followingPubkeys: unique(session.followingPubkeys)
		};
	}

	reset(): void {
		this.#state = { status: 'anonymous' };
	}
}

export const auth = new Auth();
