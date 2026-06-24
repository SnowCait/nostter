import { toStore } from 'svelte/store';

export type AuthStatus = 'idle' | 'restoring' | 'authenticating' | 'authenticated' | 'anonymous';

class Auth {
	status = $state<AuthStatus>('idle');
	pubkey = $state('');
	followees = $state<string[]>([]);
	originalFollowees = $state<string[]>([]);
	followeesSet = $derived(new Set(this.followees));

	isInitializing = $derived(this.status === 'idle' || this.status === 'restoring');
	isReady = $derived(this.status === 'authenticated' || this.status === 'anonymous');
	isAuthenticated = $derived(this.status === 'authenticated');

	beginRestoring(): void {
		this.status = 'restoring';
	}

	beginAuthenticating(): void {
		this.status = 'authenticating';
	}

	commit(pubkey: string, followees: string[], originalFollowees: string[]): void {
		this.pubkey = pubkey;
		this.followees = followees;
		this.originalFollowees = originalFollowees;
		this.status = 'authenticated';
	}

	updateFollowees(followees: string[], originalFollowees: string[]): void {
		this.followees = followees;
		this.originalFollowees = originalFollowees;
	}

	setAnonymous(): void {
		this.status = 'anonymous';
	}
}

export const auth = new Auth();

export const isInitializing = toStore(() => auth.isInitializing);
export const isReady = toStore(() => auth.isReady);
export const isAuthenticated = toStore(() => auth.isAuthenticated);
