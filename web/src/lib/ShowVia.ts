import { persistedStore } from '$lib/persisted-store';

export const showVia = persistedStore<boolean>('preference:show-via', false);
