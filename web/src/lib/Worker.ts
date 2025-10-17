import { startVerificationServiceHost, type EventVerifier } from 'rx-nostr-crypto';
import { Event as EventWrapper, loadWasmSync } from '@rust-nostr/nostr-sdk';
import type { Event } from 'nostr-typedef';

loadWasmSync();

const verifier: EventVerifier = async (event: Event) => {
	const json = JSON.stringify(event);
	return EventWrapper.fromJson(json).verify();
};

startVerificationServiceHost(verifier);
