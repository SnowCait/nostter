import { persistedStore } from '$lib/WebStorage';

export const seenOnRelayIcon = persistedStore<boolean>('preference:seen-on-relay-icon', false);
