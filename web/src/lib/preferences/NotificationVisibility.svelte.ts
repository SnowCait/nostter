import { followeesOfFollowees } from '$lib/author/MuteAutomatically';
import { followees } from '$lib/stores/Author';
import { persistedStore } from '$lib/WebStorage';
import { get } from 'svelte/store';

export const notificationVisibilities = ['all', 'follows_of_follows', 'follows'] as const;
export type NotificationVisibility = (typeof notificationVisibilities)[number];
export const notificationVisibility = persistedStore<NotificationVisibility>(
	'preference:notification:visibility',
	'all'
);

export function isVisibleNotification(pubkey: string): boolean {
	switch (get(notificationVisibility)) {
		case 'all': {
			return true;
		}
		case 'follows_of_follows': {
			return get(followeesOfFollowees).has(pubkey);
		}
		case 'follows': {
			return get(followees).includes(pubkey);
		}
		default: {
			console.warn('[notification visibility logic error]', get(notificationVisibility));
			return true;
		}
	}
}
