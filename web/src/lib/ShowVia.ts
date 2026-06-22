import { persistedStore } from '$lib/WebStorage';

export const showVia = persistedStore<boolean>('preference:show-via', false);
