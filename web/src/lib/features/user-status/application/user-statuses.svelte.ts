import type { Event } from 'nostr-tools';
import { UserStatuses } from 'nostr-tools/kinds';
import type { Observable } from 'rxjs';
import { untrack } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { filterLimitItems } from '$lib/Constants';
import { chunk } from '$lib/array';
import {
	generalStatusType,
	getActiveUserStatus,
	isUserStatusEvent,
	mergeLatestUserStatusEvent,
	musicStatusType,
	type LatestUserStatusEvents,
	type UserStatus
} from '$lib/nostr/protocol/nip38';
import { requestEvents } from '$lib/nostr/relay/event-operations';
import { isHttpUrl } from '$lib/url';

export type DisplayedUserStatus = UserStatus & { link?: URL };
export type DisplayedUserStatuses = {
	general?: DisplayedUserStatus;
	music?: DisplayedUserStatus;
};

type Dependencies = {
	request(pubkeys: string[]): Observable<Event>;
};

const displayedStatusTypes = [generalStatusType, musicStatusType];
const requestBatchDelay = 100;
// setTimeout overflows above this delay and fires immediately.
const maxTimerDelay = 2 ** 31 - 1;
const noStatuses: DisplayedUserStatuses = {};

const defaultDependencies: Dependencies = {
	request: (authors) =>
		requestEvents([{ kinds: [UserStatuses], authors, '#d': displayedStatusTypes }])
};

function currentTime(): number {
	return Math.floor(Date.now() / 1000);
}

function toDisplayedStatus(event: Event | undefined, now: number): DisplayedUserStatus | undefined {
	const status = getActiveUserStatus(event, now);
	if (status === undefined) {
		return undefined;
	}
	const url = status.url === undefined ? null : URL.parse(status.url);
	return url !== null && isHttpUrl(url) ? { ...status, link: url } : status;
}

class UserStatusEntry {
	events = $state.raw<LatestUserStatusEvents>(new Map());
	#now = $state(currentTime());
	observers = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;

	// Not $derived because entries can be created inside an effect, which would own the derived.
	get statuses(): DisplayedUserStatuses {
		const general = toDisplayedStatus(this.events.get(generalStatusType), this.#now);
		const music = toDisplayedStatus(this.events.get(musicStatusType), this.#now);
		return general === undefined && music === undefined ? noStatuses : { general, music };
	}

	refresh(): void {
		this.#now = currentTime();
		this.#schedule();
	}

	stop(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}

	#schedule(): void {
		this.stop();
		const { general, music } = this.statuses;
		const expirations = [general?.expiration, music?.expiration].filter(
			(expiration) => expiration !== undefined
		);
		if (expirations.length === 0) {
			return;
		}
		const next = Math.min(...expirations);
		const delay = Math.min(Math.max(next * 1000 - Date.now(), 0), maxTimerDelay);
		this.#timer = setTimeout(() => this.refresh(), delay);
	}
}

export class UserStatusRegistry {
	#entries = new SvelteMap<string, UserStatusEntry>();
	#requested = new Set<string>();
	#queue = new Set<string>();

	constructor(private readonly dependencies: Dependencies = defaultDependencies) {}

	get(pubkey: string): DisplayedUserStatuses {
		return this.#entries.get(pubkey)?.statuses ?? noStatuses;
	}

	/**
	 * Keeps the statuses of the pubkey fetched and up to date with expiration
	 * until the returned function is called.
	 */
	observe(pubkey: string): () => void {
		const entry = untrack(() => {
			const entry = this.#entry(pubkey);
			entry.observers++;
			if (entry.observers === 1) {
				entry.refresh();
			}
			this.#request(pubkey);
			return entry;
		});

		let released = false;
		return () => {
			if (released) {
				return;
			}
			released = true;
			entry.observers--;
			if (entry.observers === 0) {
				entry.stop();
			}
		};
	}

	ingest(event: Event): void {
		if (!isUserStatusEvent(event)) {
			return;
		}
		const entry = this.#entry(event.pubkey);
		const events = mergeLatestUserStatusEvent(entry.events, event);
		if (events === entry.events) {
			return;
		}
		entry.events = events;
		if (entry.observers > 0) {
			entry.refresh();
		}
	}

	#entry(pubkey: string): UserStatusEntry {
		let entry = this.#entries.get(pubkey);
		if (entry === undefined) {
			entry = new UserStatusEntry();
			this.#entries.set(pubkey, entry);
		}
		return entry;
	}

	#request(pubkey: string): void {
		if (this.#requested.has(pubkey)) {
			return;
		}
		this.#requested.add(pubkey);
		if (this.#queue.size === 0) {
			setTimeout(() => this.#flush(), requestBatchDelay);
		}
		this.#queue.add(pubkey);
	}

	#flush(): void {
		const pubkeys: string[] = [];
		for (const pubkey of this.#queue) {
			if ((this.#entries.get(pubkey)?.observers ?? 0) > 0) {
				pubkeys.push(pubkey);
			} else {
				// Released before the request was sent, so the next observer requests again.
				this.#requested.delete(pubkey);
			}
		}
		this.#queue.clear();

		for (const authors of chunk(pubkeys, filterLimitItems)) {
			this.dependencies.request(authors).subscribe({
				next: (event) => this.ingest(event),
				error: (error) => {
					console.warn('[user status request failed]', error);
					for (const pubkey of authors) {
						this.#requested.delete(pubkey);
					}
				}
			});
		}
	}
}

export const userStatuses = new UserStatusRegistry();
