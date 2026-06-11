import { persistedStore } from '$lib/WebStorage';

export const showUserStatus = persistedStore('preference:user-status', true);
