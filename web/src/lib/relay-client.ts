import { createDefaultRelaySettings } from '$lib/nostr/relay/default-relays';
import { auth } from '$lib/auth.svelte';
import { createRelayClient } from '$lib/nostr/relay/client';

export const rxNostr = createRelayClient(() => auth.signer);

export const defaultRelaySettings = createDefaultRelaySettings(rxNostr);
