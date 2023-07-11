import { get } from 'svelte/store';
import { pool } from '../stores/Pool';
import { nip19, type Event } from 'nostr-tools';

export class BadgeApi {
	async fetchBadges(relays: string[], pubkey: string): Promise<Badge[]> {
		const $pool = get(pool);
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve([]);
			}, 10000);

			const badges: Badge[] = [];
			const profileBadges: ProfileBadge[] = [];
			const subscribeProfileBadges = $pool.sub(relays, [
				{
					kinds: [30008],
					authors: [pubkey]
				}
			]);
			subscribeProfileBadges.on('event', (event: Event) => {
				console.log('[profile badges event]', event);
				if (
					event.tags.some(([tagName, id]) => tagName === 'd' && id === 'profile_badges')
				) {
					for (let i = 0; i < event.tags.length; i++) {
						const tag = event.tags[i];
						if (tag[0] === 'd') {
							continue;
						}

						if (tag[0] === 'a') {
							const [kind, pubkey, badgeId] = tag[1].split(':');
							i++;
							const eTag = event.tags[i];
							const [tagName, eventId, relay] = eTag;
							if (tagName === 'e') {
								const badge = {
									kind,
									pubkey,
									badgeId,
									eventId,
									relay
								} as ProfileBadge;
								profileBadges.push(badge);
							}
						}
					}
				}
			});
			subscribeProfileBadges.on('eose', () => {
				console.log('[profile badges]', profileBadges);
				const pubkeys = new Set(profileBadges.map((x) => x.pubkey));
				const subscribeBadgeDefinitions = $pool.sub(relays, [
					{
						kinds: [30009],
						authors: Array.from(pubkeys)
					}
				]);
				subscribeBadgeDefinitions.on('event', (event: Event) => {
					console.log('[badge definitions event]', event);
					const badge = {} as Badge;
					for (const [tagName, tagContent] of event.tags) {
						switch (tagName) {
							case 'd':
								badge.id = tagContent;
								break;
							case 'name':
								badge.name = tagContent;
								break;
							case 'description':
								badge.description = tagContent;
								break;
							case 'image':
								badge.image = tagContent;
								break;
							case 'thumb':
								badge.thumb = tagContent;
								break;
						}
					}
					console.log('[badge]', badge);
					if (
						profileBadges.some(
							(x) => x.pubkey === event.pubkey && x.badgeId === badge.id
						)
					) {
						badge.naddr = nip19.naddrEncode({
							identifier: badge.id,
							pubkey: event.pubkey,
							kind: 30009
						});
						badges.push(badge);
					}
				});
				subscribeBadgeDefinitions.on('eose', () => {
					console.log('[badges]', badges);
					resolve(badges);
				});
			});
		});
	}
}

export interface Badge {
	id: string;
	name: string;
	description: string;
	image: string;
	thumb: string;
	naddr: string;
}

interface ProfileBadge {
	kind: string;
	pubkey: string;
	badgeId: string;
	eventId: string;
	relay: string;
}
