import type { Event } from 'nostr-tools';

export class WebStorage {
	public constructor(private readonly storage: Storage) {}

	public get(key: string): string | null {
		return this.storage.getItem(`nostter:${key}`);
	}

	public set(key: string, value: string): void {
		this.storage.setItem(`nostter:${key}`, value);
	}

	public clear(): void {
		this.storage.clear();
	}

	public getReplaceableEvent(kind: number): Event | null {
		const json = this.get(`kind:${kind}`);
		if (json === null) {
			return null;
		}
		try {
			return JSON.parse(json);
		} catch (error) {
			console.error('[invalid event]', error);
			return null;
		}
	}

	public setReplaceableEvent(event: Event): void {
		const cache = this.getReplaceableEvent(event.kind);
		if (cache === null || cache.created_at < event.created_at) {
			this.set(`kind:${event.kind}`, JSON.stringify(event));
		}
	}
}
