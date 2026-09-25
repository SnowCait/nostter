import type { Event } from 'nostr-tools';
import { findIdentifier } from './nostr/protocol/event-address';
import { shouldReplaceCurrentEvent } from './nostr/protocol/replaceable-event';
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

	public getReplaceableEvent(kind: number): Event | undefined {
		const json = this.get(`kind:${kind}`);
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
		const cache = this.getReplaceableEvent(event.kind);
		if (
			cache === undefined ||
			cache.pubkey !== accountPubkey ||
			(event.kind === 10000
				? shouldReplaceCurrentEvent(event, cache)
				: cache.created_at < event.created_at)
		) {
			this.set(`kind:${event.kind}`, JSON.stringify(event));
			this.setCachedAt(accountPubkey);
			eventCache.addIfNotExists(event); // Fire and forget
		}
	}

	public getParameterizedReplaceableEvent(kind: number, identifier: string): Event | undefined {
		const json = this.get(`kind:${kind}:${identifier}`);
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

	public getParameterizedIdentifiers(kind: number): string[] {
		const prefix = `nostter:kind:${kind}:`;
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
		const cache = this.getParameterizedReplaceableEvent(event.kind, identifier);
		if (
			cache === undefined ||
			cache.pubkey !== accountPubkey ||
			(event.kind === 30007
				? shouldReplaceCurrentEvent(event, cache)
				: cache.created_at < event.created_at)
		) {
			this.set(`kind:${event.kind}:${identifier}`, JSON.stringify(event));
			this.setCachedAt(accountPubkey);
		}
	}

	public removeParameterizedReplaceableEvent(kind: number, identifier: string): void {
		this.remove(`kind:${kind}:${identifier}`);
	}

	public getCachedAt(): number | null {
		const cachedAt = this.get('cached_at');
		return cachedAt === null ? null : Number(cachedAt);
	}

	public getCachedAccountPubkey(): string | null {
		return this.get('cached_account_pubkey');
	}

	private setCachedAt(accountPubkey: string) {
		const now = Math.floor(Date.now() / 1000);
		this.set('cached_at', `${now}`);
		this.set('cached_account_pubkey', accountPubkey);
	}
}
