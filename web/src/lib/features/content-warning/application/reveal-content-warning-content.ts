import type { Event } from 'nostr-tools';
import { normalizeURL } from 'nostr-tools/utils';
import {
	getContentWarningContentSource,
	isValidContentWarningPayload,
	type ContentWarningPayloadReference
} from '$lib/nostr/protocol/content-warning-payload';
import { fetchEventById } from '$lib/nostr/relay/event-operations';
import { getSeenOnRelays } from '$lib/nostr/relay/relay-hints';

interface Dependencies {
	fetchEventById(id: string, relays: string[]): Promise<Event | undefined>;
	getSeenOnRelays(eventId: string): string[] | undefined;
}

/**
 * Returns the content to show when a content warning is opened,
 * or undefined when a referenced payload is unavailable or invalid (fail-closed).
 */
export type RevealContentWarningContent = (structure: Event) => Promise<string | undefined>;

export function createContentWarningContentRevealer(
	dependencies: Dependencies
): RevealContentWarningContent {
	const payloads = new Map<string, Promise<Event | undefined>>();

	function getPayloadRelays(structure: Event, reference: ContentWarningPayloadReference) {
		// Relay hints and seen-on relays are only candidates; authenticity is checked by validation.
		const candidates = [
			...(reference.relay === undefined ? [] : [reference.relay]),
			...(dependencies.getSeenOnRelays(structure.id) ?? [])
		];
		const relays = new Set<string>();
		for (const candidate of candidates) {
			try {
				relays.add(normalizeURL(candidate));
			} catch {
				continue;
			}
		}
		return [...relays];
	}

	function fetchPayload(
		structure: Event,
		reference: ContentWarningPayloadReference
	): Promise<Event | undefined> {
		const cached = payloads.get(reference.id);
		if (cached !== undefined) {
			return cached;
		}

		const payload = dependencies
			.fetchEventById(reference.id, getPayloadRelays(structure, reference))
			.catch((error) => {
				console.warn('[content warning payload fetch failed]', reference.id, error);
				return undefined;
			})
			.then((event) => {
				if (event === undefined) {
					payloads.delete(reference.id);
				}
				return event;
			});
		payloads.set(reference.id, payload);
		return payload;
	}

	return async (structure) => {
		const source = getContentWarningContentSource(structure);
		if (source.type === 'inline') {
			return source.content;
		}

		const payload = await fetchPayload(structure, source.reference);
		if (
			payload === undefined ||
			!isValidContentWarningPayload(structure, source.reference, payload)
		) {
			return undefined;
		}
		return payload.content;
	};
}

export const revealContentWarningContent = createContentWarningContentRevealer({
	fetchEventById,
	getSeenOnRelays
});
