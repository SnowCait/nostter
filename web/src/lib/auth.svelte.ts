import { toStore } from 'svelte/store';
import { unique } from './array';

export type AuthStatus = 'idle' | 'restoring' | 'authenticating' | 'authenticated' | 'anonymous';

export class Auth {
	#status = $state<AuthStatus>('idle');
	pubkey = $state('');
	#followees = $state<string[]>([]);
	#followingPubkeys = $state<string[]>([]);

	get status(): AuthStatus {
		return this.#status;
	}

	get followees(): string[] {
		return this.#followees;
	}

	get followingPubkeys(): string[] {
		return this.#followingPubkeys;
	}

	followeesSet = $derived(new Set(this.#followees));

	isInitializing = $derived(this.#status === 'idle' || this.#status === 'restoring');
	isReady = $derived(this.#status === 'authenticated' || this.#status === 'anonymous');
	isAuthenticated = $derived(this.#status === 'authenticated');

	beginRestoring(): void {
		this.#status = 'restoring';
	}

	beginAuthenticating(): void {
		this.#status = 'authenticating';
	}

	updateFollowingPubkeys(followingPubkeys: string[], accountPubkey: string): void {
		this.#followingPubkeys = followingPubkeys;
		this.#followees = unique([...this.#followingPubkeys, accountPubkey]);
	}

	setAuthenticated(): void {
		this.#status = 'authenticated';
	}

	setAnonymous(): void {
		this.#status = 'anonymous';
	}

	reset(): void {
		this.pubkey = '';
		this.#followees = [];
		this.#followingPubkeys = [];
		this.#status = 'anonymous';
	}
}

export const auth = new Auth();

export const isInitializing = toStore(() => auth.isInitializing);
export const isReady = toStore(() => auth.isReady);
export const isAuthenticated = toStore(() => auth.isAuthenticated);
