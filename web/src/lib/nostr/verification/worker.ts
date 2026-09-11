import { startVerificationServiceHost, type EventVerifier } from 'rx-nostr-crypto';
import { Event as EventWrapper, loadWasmSync } from '@rust-nostr/nostr-sdk';
import type * as Nostr from 'nostr-typedef';

loadWasmSync();

const verifier: EventVerifier = async (event: Nostr.Event) => {
	const json = JSON.stringify(event);
	return EventWrapper.fromJson(json).verify();
};

startVerificationServiceHost(verifier);
