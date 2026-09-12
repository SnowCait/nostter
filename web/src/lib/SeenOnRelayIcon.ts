import { persistedStore } from '$lib/platform/storage/persisted-store';

export const seenOnRelayIcon = persistedStore<boolean>('preference:seen-on-relay-icon', false);
