import { persistedStore } from '$lib/persisted-store';

export const seenOnRelayIcon = persistedStore<boolean>('preference:seen-on-relay-icon', false);
