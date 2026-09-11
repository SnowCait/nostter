import type * as Nostr from 'nostr-typedef';
import { Nip11Registry, createRxNostr, now } from 'rx-nostr';
import { timeout } from '$lib/Constants';
import { Signer } from '$lib/Signer';
import { verificationClient } from '$lib/nostr/verification/client';

Nip11Registry.setDefault({
	limitation: {
		max_subscriptions: 20
	}
});

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
