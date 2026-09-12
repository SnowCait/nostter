import { persistedStore } from '$lib/platform/storage/persisted-store';

export const showVia = persistedStore<boolean>('preference:show-via', false);
