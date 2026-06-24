import { toStore } from 'svelte/store';

export type AuthStatus = 'idle' | 'restoring' | 'authenticating' | 'authenticated' | 'anonymous';

class Auth {
	status = $state<AuthStatus>('idle');

	isInitializing = $derived(this.status === 'idle' || this.status === 'restoring');
	isReady = $derived(this.status === 'authenticated' || this.status === 'anonymous');
	isAuthenticated = $derived(this.status === 'authenticated');

	beginRestoring(): void {
		this.status = 'restoring';
	}

	beginAuthenticating(): void {
		this.status = 'authenticating';
	}

	setAuthenticated(): void {
		this.status = 'authenticated';
	}

	setAnonymous(): void {
		this.status = 'anonymous';
	}
}

export const auth = new Auth();

export const isInitializing = toStore(() => auth.isInitializing);
export const isReady = toStore(() => auth.isReady);
export const isAuthenticated = toStore(() => auth.isAuthenticated);
