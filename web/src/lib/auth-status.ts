import { derived, writable } from 'svelte/store';

export type AuthStatus = 'idle' | 'restoring' | 'authenticating' | 'authenticated' | 'anonymous';

export const authStatus = writable<AuthStatus>('idle');

export const isInitializing = derived(authStatus, ($s) => $s === 'idle' || $s === 'restoring');
export const isReady = derived(authStatus, ($s) => $s === 'authenticated' || $s === 'anonymous');
export const isAuthenticated = derived(authStatus, ($s) => $s === 'authenticated');
