import { NostrConnect } from 'nostr-tools/kinds';
import { toBunkerURL } from 'nostr-tools/nip46';
import { createRxForwardReq, createRxNostr, now, type RxNostr } from 'rx-nostr';
import { get } from 'svelte/store';
import { pubkey } from './stores/Author';
import type { Subscription } from 'rxjs';
import { persistedStore } from './WebStorage';
import type { Persisted } from 'svelte-persisted-store';
import { Signer } from './Signer';
import { verificationClient } from './timelines/MainTimeline';

class RemoteSigner {
	#relays: string[];
	#secret: Persisted<string>;
	#rxNostr: RxNostr;
	#subscription?: Subscription;

	constructor(relays: string[] = []) {
		this.#relays = relays.length > 0 ? relays : ['wss://ephemeral.snowflare.cc/'];
		this.#secret = persistedStore<string>('remote-signer-secret', '');
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
		return toBunkerURL({
			pubkey: get(pubkey),
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
		const req = createRxForwardReq();
		this.#subscription = this.#rxNostr!.use(req).subscribe(async ({ event: requestEvent }) => {
			console.debug('[remote signer request]', requestEvent);
			const content = await Signer.decryptNip44(requestEvent.pubkey, requestEvent.content);
			try {
				const { id, method, params } = JSON.parse(content) as {
					id: string;
					method: string;
					params: string[];
				};
				const { result, error } = await this.#call(method, params);
				const responseEvent = await Signer.signEvent({
					kind: NostrConnect,
					content: await Signer.encryptNip44(
						requestEvent.pubkey,
						JSON.stringify({ id, result, error })
					),
					tags: [['p', requestEvent.pubkey]],
					created_at: now()
				});
				console.debug('[remote signer response]', responseEvent, {
					method,
					params,
					result,
					error
				});
				this.#rxNostr?.send(responseEvent);
			} catch (error) {
				console.error('[remote signer response]', error);
			}
		});
		req.emit([{ kinds: [NostrConnect], '#p': [get(pubkey)] }]);
	}

	#unsubscribe(): void {
		this.#subscription?.unsubscribe();
	}

	//#endregion

	//#region Methods

	async #call(method: string, params: string[]): Promise<{ result: string; error?: string }> {
		switch (method) {
			case 'connect': {
				if (params[0] === get(pubkey) && params[1] === get(this.#secret)) {
					return { result: 'ack' };
				} else {
					return { result: '', error: 'invalid params' };
				}
			}
			case 'sign_event': {
				try {
					const event = await Signer.signEvent(JSON.parse(params[0]));
					return { result: JSON.stringify(event) };
				} catch {
					return { result: '', error: 'failed to sign event' };
				}
			}
			case 'ping': {
				return { result: 'pong' };
			}
			case 'get_public_key': {
				return { result: await Signer.getPublicKey() };
			}
			case 'nip04_encrypt': {
				try {
					return { result: await Signer.encrypt(params[0], params[1]) };
				} catch {
					return { result: '', error: 'failed to encrypt' };
				}
			}
			case 'nip04_decrypt': {
				try {
					return { result: await Signer.decrypt(params[0], params[1]) };
				} catch {
					return { result: '', error: 'failed to decrypt' };
				}
			}
			case 'nip44_encrypt': {
				try {
					return { result: await Signer.encryptNip44(params[0], params[1]) };
				} catch {
					return { result: '', error: 'failed to encrypt' };
				}
			}
			case 'nip44_decrypt': {
				try {
					return { result: await Signer.decryptNip44(params[0], params[1]) };
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
