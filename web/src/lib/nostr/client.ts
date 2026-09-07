import type * as Nostr from 'nostr-typedef';
import { Nip11Registry, createRxNostr, now } from 'rx-nostr';
import { createNoopClient, createVerificationServiceClient } from 'rx-nostr-crypto';
import { browser } from '$app/environment';
import { timeout } from '$lib/Constants';
import { Signer } from '$lib/Signer';
import workerUrl from '$lib/Worker?worker&url';

Nip11Registry.setDefault({
	limitation: {
		max_subscriptions: 20
	}
});

export const verificationClient = browser
	? createVerificationServiceClient({
			worker: new Worker(workerUrl, { type: 'module' }),
			timeout: 600000
		})
	: createNoopClient();
verificationClient.start();

export const rxNostr = createRxNostr({
	verifier: verificationClient.verifier,
	connectionStrategy: 'lazy-keep',
	eoseTimeout: timeout,
	okTimeout: timeout,
	retry: { strategy: 'exponential', maxCount: 5, initialDelay: 1000, polite: true },
	authenticator: 'auto',
	signer: {
		getPublicKey: () => Signer.getPublicKey(),
		signEvent: async <K extends number>(
			params: Nostr.EventParameters<K>
		): Promise<Nostr.Event<K>> => {
			if (params.sig) {
				return params as Nostr.Event<K>;
			}

			const event = await Signer.signEvent({
				...params,
				tags: params.tags ?? [],
				created_at: params.created_at ?? now()
			});
			return event as Nostr.Event<K>;
		}
	}
});
