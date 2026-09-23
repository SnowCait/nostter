import type * as Nostr from 'nostr-typedef';
import { Nip11Registry, createRxNostr, now, type RxNostr } from 'rx-nostr';
import { timeout } from '$lib/Constants';
import type { Signer } from '$lib/nostr/signing/signer';
import { verificationClient } from '$lib/nostr/verification/client';

Nip11Registry.setDefault({
	limitation: {
		max_subscriptions: 20
	}
});

type RelaySignerCapabilities = Pick<Signer, 'getPublicKey' | 'signEvent'>;

export function createRelayClient(getSigner: () => RelaySignerCapabilities | undefined): RxNostr {
	return createRxNostr({
		verifier: verificationClient.verifier,
		connectionStrategy: 'lazy-keep',
		eoseTimeout: timeout,
		okTimeout: timeout,
		retry: { strategy: 'exponential', maxCount: 5, initialDelay: 1000, polite: true },
		authenticator: 'auto',
		signer: {
			getPublicKey: async () => {
				const signer = getSigner();
				if (signer === undefined) {
					throw new Error('[logic error]');
				}
				return signer.getPublicKey();
			},
			signEvent: async <K extends number>(
				params: Nostr.EventParameters<K>
			): Promise<Nostr.Event<K>> => {
				if (params.sig) {
					return params as Nostr.Event<K>;
				}

				const signer = getSigner();
				if (signer === undefined) {
					throw new Error('[logic error]');
				}
				const event = await signer.signEvent({
					...params,
					tags: params.tags ?? [],
					created_at: params.created_at ?? now()
				});
				return event as Nostr.Event<K>;
			}
		}
	});
}
