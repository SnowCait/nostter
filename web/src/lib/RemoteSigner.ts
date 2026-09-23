import { NostrConnect } from 'nostr-tools/kinds';
import { toBunkerURL } from 'nostr-tools/nip46';
import { createRxForwardReq, createRxNostr, now, uniq, type RxNostr } from 'rx-nostr';
import { get } from 'svelte/store';
import { auth } from '$lib/auth.svelte';
import type { Subscription } from 'rxjs';
import { persistedStore } from '$lib/platform/storage/persisted-store';
import type { Persisted } from 'svelte-persisted-store';
import type { Signer } from '$lib/nostr/signing/signer';
import { verificationClient } from './timelines/MainTimeline';

type RemoteSignerCapabilities = Pick<Signer, 'getPublicKey' | 'signEvent' | 'nip04' | 'nip44'>;

class RemoteSigner {
	#relays: string[];
	#secret: Persisted<string>;
	#clientPubkey: Persisted<string>;
	#rxNostr: RxNostr;
	#subscription?: Subscription;

	constructor(relays: string[] = []) {
		this.#relays = relays.length > 0 ? relays : ['wss://ephemeral.snowflare.cc/'];
		this.#secret = persistedStore<string>('remote-signer:secret', '');
		this.#clientPubkey = persistedStore<string>('remote-signer:client-pubkey', '');
		this.#rxNostr = createRxNostr({ verifier: verificationClient.verifier });
		this.#rxNostr.setDefaultRelays(this.#relays);
	}

	//#region Properties

	get enabled(): boolean {
		return get(this.#secret) !== '';
	}

	get bunkerUrl(): string {
		if (!this.enabled) {
			return '';
		}
		const accountPubkey = auth.pubkey;
		if (accountPubkey === undefined) {
			throw new Error('Not authenticated');
		}
		return toBunkerURL({
			pubkey: accountPubkey,
			relays: this.#relays,
			secret: get(this.#secret)
		});
	}

	//#endregion

	//#region Enable

	public enable(): void {
		this.#secret.set(crypto.randomUUID());
	}

	public disable(): void {
		this.#secret.reset();
		this.#clientPubkey.reset();
		this.#unsubscribe();
	}

	//#endregion

	//#region Subscription

	public subscribeIfEnabled(): void {
		console.debug('[remote signer subscribe]', this.enabled, this.#relays);
		if (!this.enabled) {
			return;
		}
		this.#subscribe();
	}

	#subscribe(): void {
		if (this.#subscription && !this.#subscription.closed) {
			return;
		}
		const accountPubkey = auth.pubkey;
		if (accountPubkey === undefined) {
			throw new Error('Not authenticated');
		}
		const req = createRxForwardReq();
		this.#subscription = this.#rxNostr!.use(req)
			.pipe(uniq())
			.subscribe(async ({ event: requestEvent }) => {
				const signer = auth.signer;
				if (signer === undefined) {
					throw new Error('[logic error]');
				}
				const capabilities: RemoteSignerCapabilities = {
					getPublicKey: () => signer.getPublicKey(),
					signEvent: (event) => signer.signEvent(event),
					nip04: signer.nip04,
					nip44: signer.nip44
				};
				const nip44 = capabilities.nip44;
				if (nip44 === undefined) {
					throw new Error('[logic error]');
				}
				const content = await nip44.decrypt(requestEvent.pubkey, requestEvent.content);
				try {
					const { id, method, params } = JSON.parse(content) as {
						id: string;
						method: string;
						params: string[];
					};
					const { result, error } = await this.#call(
						capabilities,
						method,
						params,
						requestEvent.pubkey
					);
					const responseEvent = await capabilities.signEvent({
						kind: NostrConnect,
						content: await nip44.encrypt(
							requestEvent.pubkey,
							JSON.stringify({ id, result, error })
						),
						tags: [['p', requestEvent.pubkey]],
						created_at: now()
					});
					console.debug('[remote signer response]', { method, params, result, error });
					this.#rxNostr?.send(responseEvent);
				} catch (error) {
					console.error('[remote signer error]', error);
				}
			});
		req.emit([{ kinds: [NostrConnect], '#p': [accountPubkey] }]);
	}

	#unsubscribe(): void {
		this.#subscription?.unsubscribe();
		this.#subscription = undefined;
	}

	//#endregion

	//#region Methods

	async #call(
		capabilities: RemoteSignerCapabilities,
		method: string,
		params: string[],
		clientPubkey: string
	): Promise<{ result: string; error?: string }> {
		if (method !== 'connect' && clientPubkey !== get(this.#clientPubkey)) {
			return { result: '', error: 'not connected' };
		}

		switch (method) {
			case 'connect': {
				if (params[0] === auth.pubkey && params[1] === get(this.#secret)) {
					this.#clientPubkey.set(clientPubkey);
					return { result: 'ack' };
				} else {
					return { result: '', error: 'invalid params' };
				}
			}
			case 'sign_event': {
				try {
					const event = await capabilities.signEvent(JSON.parse(params[0]));
					return { result: JSON.stringify(event) };
				} catch {
					return { result: '', error: 'failed to sign event' };
				}
			}
			case 'ping': {
				return { result: 'pong' };
			}
			case 'get_public_key': {
				return { result: await capabilities.getPublicKey() };
			}
			case 'nip04_encrypt': {
				try {
					const nip04 = capabilities.nip04;
					if (nip04 === undefined) {
						throw new Error('[logic error]');
					}
					return { result: await nip04.encrypt(params[0], params[1]) };
				} catch {
					return { result: '', error: 'failed to encrypt' };
				}
			}
			case 'nip04_decrypt': {
				try {
					const nip04 = capabilities.nip04;
					if (nip04 === undefined) {
						throw new Error('[logic error]');
					}
					return { result: await nip04.decrypt(params[0], params[1]) };
				} catch {
					return { result: '', error: 'failed to decrypt' };
				}
			}
			case 'nip44_encrypt': {
				try {
					const nip44 = capabilities.nip44;
					if (nip44 === undefined) {
						throw new Error('[logic error]');
					}
					return { result: await nip44.encrypt(params[0], params[1]) };
				} catch {
					return { result: '', error: 'failed to encrypt' };
				}
			}
			case 'nip44_decrypt': {
				try {
					const nip44 = capabilities.nip44;
					if (nip44 === undefined) {
						throw new Error('[logic error]');
					}
					return { result: await nip44.decrypt(params[0], params[1]) };
				} catch {
					return { result: '', error: 'failed to decrypt' };
				}
			}
			default: {
				return { result: '', error: 'unsupported method' };
			}
		}
	}

	//#endregion
}

export const remoteSigner = new RemoteSigner();
