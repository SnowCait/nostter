import { persistedStore } from '$lib/platform/storage/persisted-store';

export const showUserStatus = persistedStore('preference:user-status', true);
