import type { Event } from 'nostr-tools';
import { get } from 'svelte/store';
import { findIdentifier } from './EventHelper';
import { pubkey } from '../stores/Author';
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

	public setReplaceableEvent(event: Event): void {
		if (event.pubkey !== get(pubkey)) {
			throw new Error('Logic error');
		}
		const cache = this.getReplaceableEvent(event.kind);
		if (cache === undefined || cache.created_at < event.created_at) {
			this.set(`kind:${event.kind}`, JSON.stringify(event));
			this.setCachedAt();
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

	public setParameterizedReplaceableEvent(event: Event): void {
		if (event.pubkey !== get(pubkey)) {
			throw new Error('Logic error');
		}
		const identifier = findIdentifier(event.tags);
		if (identifier === undefined) {
			return;
		}
		const cache = this.getParameterizedReplaceableEvent(event.kind, identifier);
		if (cache === undefined || cache.created_at < event.created_at) {
			this.set(`kind:${event.kind}:${identifier}`, JSON.stringify(event));
			this.setCachedAt();
		}
	}

	public getCachedAt(): number | null {
		const cachedAt = this.get('cached_at');
		return cachedAt === null ? null : Number(cachedAt);
	}

	private setCachedAt() {
		const now = Math.floor(Date.now() / 1000);
		this.set('cached_at', `${now}`);
	}
}
