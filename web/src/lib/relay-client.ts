import { createRelayReadExclusion } from '$lib/nostr/relay/read-exclusion';
import { auth } from '$lib/auth.svelte';
import { createRelayClient } from '$lib/nostr/relay/client';

export const rxNostr = createRelayClient(() => auth.signer);

export const relayReadExclusion = createRelayReadExclusion(rxNostr);
