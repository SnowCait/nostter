import { writable } from 'svelte/store';

export type LoginStatusLevel = 'info' | 'success' | 'error';

export type LoginStatus = {
	key: string;
	level: LoginStatusLevel;
};

export const loginStatus = writable<LoginStatus | null>(null);

export function setLoginStatus(key: string, level: LoginStatusLevel = 'info'): void {
	loginStatus.set({ key, level });
}

export function clearLoginStatus(): void {
	loginStatus.set(null);
}
