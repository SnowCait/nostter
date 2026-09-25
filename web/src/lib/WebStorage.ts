import type { Event } from 'nostr-tools';
import { findIdentifier } from './nostr/protocol/event-address';
import { eventCache } from './cache/Events';

export class WebStorage {
	public constructor(private readonly storage: Storage) {}

	public get(key: string): string | null {
		return this.storage.getItem(`nostter:${key}`);
	}

	public set(key: string, value: string): void {
		this.storage.setItem(`nostter:${key}`, value);
	}

	public remove(key: string): void {
		this.storage.removeItem(`nostter:${key}`);
	}

	public clear(): void {
		this.storage.clear();
	}

	public getReplaceableEvent(kind: number, accountPubkey: string): Event | undefined {
		const json = this.get(`account:${accountPubkey}:kind:${kind}`);
		if (json === null) {
			return undefined;
		}
		try {
			return JSON.parse(json);
		} catch (error) {
			console.error('[invalid event]', error);
			return undefined;
		}
	}

	public setReplaceableEvent(event: Event, accountPubkey: string): void {
		if (event.pubkey !== accountPubkey) {
			throw new Error('Logic error');
		}
		const cache = this.getReplaceableEvent(event.kind, accountPubkey);
		if (cache === undefined || cache.created_at < event.created_at) {
			this.set(`account:${accountPubkey}:kind:${event.kind}`, JSON.stringify(event));
			this.setCachedAt(accountPubkey);
			eventCache.addIfNotExists(event); // Fire and forget
		}
	}

	public getParameterizedReplaceableEvent(
		kind: number,
		identifier: string,
		accountPubkey: string
	): Event | undefined {
		const json = this.get(`account:${accountPubkey}:kind:${kind}:${identifier}`);
		if (json === null) {
			return undefined;
		}
		try {
			return JSON.parse(json);
		} catch (error) {
			console.error('[invalid event]', error);
			return undefined;
		}
	}

	public getParameterizedIdentifiers(kind: number, accountPubkey: string): string[] {
		const prefix = `nostter:account:${accountPubkey}:kind:${kind}:`;
		const identifiers: string[] = [];
		for (let index = 0; index < this.storage.length; index++) {
			const key = this.storage.key(index);
			if (key?.startsWith(prefix)) identifiers.push(key.slice(prefix.length));
		}
		return identifiers;
	}

	public setParameterizedReplaceableEvent(event: Event, accountPubkey: string): void {
		if (event.pubkey !== accountPubkey) {
			throw new Error('Logic error');
		}
		const identifier = findIdentifier(event.tags);
		if (identifier === undefined) {
			return;
		}
		const cache = this.getParameterizedReplaceableEvent(event.kind, identifier, accountPubkey);
		if (cache === undefined || cache.created_at < event.created_at) {
			this.set(
				`account:${accountPubkey}:kind:${event.kind}:${identifier}`,
				JSON.stringify(event)
			);
			this.setCachedAt(accountPubkey);
		}
	}

	public removeParameterizedReplaceableEvent(
		kind: number,
		identifier: string,
		accountPubkey: string
	): void {
		this.remove(`account:${accountPubkey}:kind:${kind}:${identifier}`);
	}

	public getCachedAt(accountPubkey: string): number | null {
		const cachedAt = this.get(`account:${accountPubkey}:cached_at`);
		return cachedAt === null ? null : Number(cachedAt);
	}

	public removeCachedAt(accountPubkey: string): void {
		this.remove(`account:${accountPubkey}:cached_at`);
	}

	private setCachedAt(accountPubkey: string) {
		const now = Math.floor(Date.now() / 1000);
		this.set(`account:${accountPubkey}:cached_at`, `${now}`);
	}
}
