import type { Event } from 'nostr-tools';
import { UserStatuses } from 'nostr-tools/kinds';
import { findIdentifier } from './event-address';
import { getTagValues } from './event-tags';
import { getExpiration, isExpiredAt } from './nip40';
import { shouldReplaceCurrentEvent } from './replaceable-event';

export const generalStatusType = 'general';
export const musicStatusType = 'music';

export interface UserStatus {
	type: string;
	content: string;
	tags: string[][];
	url?: string;
	expiration?: number;
}

export type LatestUserStatusEvents = ReadonlyMap<string, Event>;

export function isUserStatusEvent(event: Event): boolean {
	return event.kind === UserStatuses;
}

export function getUserStatusType(event: Event): string {
	return findIdentifier(event.tags) ?? '';
}

/**
 * Keeps the latest event of each status type, including cleared and expired ones,
 * so that an older event arriving later cannot restore a previous status.
 */
export function mergeLatestUserStatusEvent(
	latest: LatestUserStatusEvents,
	event: Event
): LatestUserStatusEvents {
	if (!isUserStatusEvent(event)) {
		return latest;
	}
	const type = getUserStatusType(event);
	if (!shouldReplaceCurrentEvent(event, latest.get(type))) {
		return latest;
	}
	return new Map(latest).set(type, event);
}

export function getActiveUserStatus(event: Event | undefined, now: number): UserStatus | undefined {
	if (event === undefined || !isUserStatusEvent(event) || event.content === '') {
		return undefined;
	}
	const expiration = getExpiration(event.tags);
	if (isExpiredAt(expiration, now)) {
		return undefined;
	}
	return {
		type: getUserStatusType(event),
		content: event.content,
		tags: event.tags,
		url: getTagValues('r', event.tags).at(0),
		expiration
	};
}
