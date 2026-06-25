import { toStore } from 'svelte/store';
import { filterTags } from './EventHelper';

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

	updateFollowees(tags: string[][]): void {
		const pubkeys = new Set(
			filterTags('p', tags).filter((pubkey) => /[0-9a-z]{64}/.test(pubkey))
		);
		this.originalFollowees = [...pubkeys];
		pubkeys.add(this.pubkey);
		this.followees = [...pubkeys];
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
