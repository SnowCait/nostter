import { kinds as Kind, type Event } from 'nostr-tools';
import { isAddressableKind, isReplaceableKind } from 'nostr-tools/kinds';
import { getEventAddress, parseEventAddress } from '$lib/nostr/protocol/event-address';

export class AddressDeletions {
	readonly #deletedAt = new Map<string, number>();

	constructor(deletionRequests: Iterable<Event> = []) {
		for (const deletionRequest of deletionRequests) {
			this.add(deletionRequest);
		}
	}

	add(deletionRequest: Event): void {
		if (deletionRequest.kind !== Kind.EventDeletion) {
			return;
		}
		for (const address of findDeletedAddresses(deletionRequest)) {
			const deletedAt = this.#deletedAt.get(address);
			if (deletedAt === undefined || deletedAt < deletionRequest.created_at) {
				this.#deletedAt.set(address, deletionRequest.created_at);
			}
		}
	}

	isDeleted(event: Event): boolean {
		if (!isAddressKind(event.kind)) {
			return false;
		}
		const deletedAt = this.#deletedAt.get(getEventAddress(event));
		return deletedAt !== undefined && event.created_at <= deletedAt;
	}
}

function findDeletedAddresses(deletionRequest: Event): string[] {
	return deletionRequest.tags.flatMap(([name, value]) => {
		if (name !== 'a' || value === undefined) {
			return [];
		}
		const address = parseEventAddress(value);
		if (
			address === undefined ||
			address.pubkey !== deletionRequest.pubkey ||
			!isAddressKind(address.kind)
		) {
			return [];
		}
		return [`${address.kind}:${address.pubkey}:${address.identifier}`];
	});
}

function isAddressKind(kind: number): boolean {
	return isReplaceableKind(kind) || isAddressableKind(kind);
}
