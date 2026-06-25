import { toStore } from 'svelte/store';
import { unique } from './Array';
import { pubkeysFromTags } from './pubkey';

export type AuthStatus = 'idle' | 'restoring' | 'authenticating' | 'authenticated' | 'anonymous';

export class Auth {
	#status = $state<AuthStatus>('idle');
	pubkey = $state('');
	#followees = $state<string[]>([]);
	#originalFollowees = $state<string[]>([]);

	get status(): AuthStatus {
		return this.#status;
	}

	get followees(): string[] {
		return this.#followees;
	}

	get originalFollowees(): string[] {
		return this.#originalFollowees;
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

	updateFollowees(tags: string[][]): void {
		this.#originalFollowees = pubkeysFromTags(tags);
		this.#followees = unique([...this.#originalFollowees, this.pubkey]);
	}

	setAuthenticated(): void {
		this.#status = 'authenticated';
	}

	setAnonymous(): void {
		this.#status = 'anonymous';
	}
}

export const auth = new Auth();

export const isInitializing = toStore(() => auth.isInitializing);
export const isReady = toStore(() => auth.isReady);
export const isAuthenticated = toStore(() => auth.isAuthenticated);
