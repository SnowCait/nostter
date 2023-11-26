import { get } from 'svelte/store';
import type { Event } from 'nostr-typedef';
import type { pubkey } from './Types';
import type { Metadata } from './Items';
import { metadataStore } from './cache/Events';

export const unsentToastNotifications = new Map<pubkey, Event[]>();

export class ToastNotification {
	public notify(event: Event) {
		const $metadataStore = get(metadataStore);
		const metadata = $metadataStore.get(event.pubkey);
		if (metadata !== undefined) {
			this.send(event);
		} else {
			this.enqueue(event);
		}
	}

	private send(event: Event) {
		if (window.Notification === undefined || Notification.permission !== 'granted') {
			return;
		}

		let body = '';
		switch (event.kind) {
			case 1: {
				body = event.content;
				break;
			}
			case 6: {
				body = 'Repost';
				break;
			}
			case 7: {
				body = event.content.replace('+', 'Like').replace('-', 'Dislike');
				break;
			}
			case 9735: {
				body = 'Zap';
				break;
			}
			default:
				console.error('[toast notification unsupported kind]', event);
				return;
		}

		const $metadataStore = get(metadataStore);
		const metadata = $metadataStore.get(event.pubkey);
		if (metadata === undefined) {
			console.error('[toast notification logic error]');
			return;
		}
		new Notification(`@${metadata.name}`, {
			icon: metadata.picture,
			body
		});
	}

	private enqueue(event: Event) {
		let unsentEvents = unsentToastNotifications.get(event.pubkey);
		if (unsentEvents === undefined) {
			unsentEvents = [];
		}
		if (!unsentEvents.some((x) => x.id === event.id)) {
			unsentEvents.push(event);
		}
		unsentToastNotifications.set(event.pubkey, unsentEvents);
	}

	public dequeue(metadata: Metadata) {
		let unsentEvents = unsentToastNotifications.get(metadata.event.pubkey);
		if (unsentEvents === undefined || unsentEvents.length === 0) {
			return;
		}
		for (const event of unsentEvents) {
			this.send(event);
		}
	}
}
