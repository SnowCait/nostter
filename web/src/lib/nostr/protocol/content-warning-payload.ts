import type { Event } from 'nostr-tools';
import { isValidEventId } from './event-id';
import { getContentWarning } from './nip36';
import { isSecureRelayUrl } from './relay-url';

// Experimental format: https://github.com/Lokuyow/ehagaki/blob/42884debf95bb03aaf94449aa25cc3040c4cca8c/docs/SENSITIVE_CONTENT_PAYLOAD_DESIGN.md
export const contentWarningPayloadKind = 36;

const structureKinds: readonly number[] = [1, 42, 1111];

type StructureEvent = Pick<Event, 'kind' | 'pubkey' | 'content' | 'tags'>;

export interface ContentWarningPayloadReference {
	id: string;
	relay: string | undefined;
}

export type ContentWarningContentSource =
	| { type: 'inline'; content: string }
	| { type: 'payload'; reference: ContentWarningPayloadReference };

export function getContentWarningPayloadReference(
	event: StructureEvent
): ContentWarningPayloadReference | undefined {
	// Non-empty content is existing NIP-36, which takes precedence over any c tag.
	if (
		event.content !== '' ||
		!structureKinds.includes(event.kind) ||
		getContentWarning(event.tags) === undefined
	) {
		return undefined;
	}

	const cTags = event.tags.filter(([name]) => name === 'c');
	if (cTags.length !== 1) {
		return undefined;
	}

	const [, id, relay] = cTags[0];
	if (!isValidEventId(id)) {
		return undefined;
	}

	return { id, relay: isSecureRelayUrl(relay) ? relay : undefined };
}

export function getContentWarningContentSource(event: StructureEvent): ContentWarningContentSource {
	const reference = getContentWarningPayloadReference(event);
	return reference === undefined
		? { type: 'inline', content: event.content }
		: { type: 'payload', reference };
}

export function isValidContentWarningPayload(
	structure: StructureEvent,
	reference: ContentWarningPayloadReference,
	payload: Pick<Event, 'id' | 'kind' | 'pubkey' | 'tags'>
): boolean {
	if (
		payload.id !== reference.id ||
		payload.kind !== contentWarningPayloadKind ||
		payload.pubkey !== structure.pubkey
	) {
		return false;
	}

	const kTags = payload.tags.filter(([name]) => name === 'k');
	return kTags.length === 1 && kTags[0][1] === String(structure.kind);
}
