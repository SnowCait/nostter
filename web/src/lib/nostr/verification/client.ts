import { createNoopClient, createVerificationServiceClient } from 'rx-nostr-crypto';
import { browser } from '$app/environment';
import workerUrl from '$lib/nostr/verification/worker?worker&url';

export const verificationClient = browser
	? createVerificationServiceClient({
			worker: new Worker(workerUrl, { type: 'module' }),
			timeout: 600000
		})
	: createNoopClient();
verificationClient.start();
