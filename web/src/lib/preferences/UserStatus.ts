import { persistedStore } from '$lib/persisted-store';

export const showUserStatus = persistedStore('preference:user-status', true);
