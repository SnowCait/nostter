import type { Event } from 'nostr-tools';
import {
	ChannelCreation,
	ChannelMessage,
	ChannelMetadata as ChannelMetadataKind
} from 'nostr-tools/kinds';
import { sortEvents } from 'nostr-tools/core';
import {
	createRxForwardReq,
	createRxBackwardReq,
	createRxOneshotReq,
	now,
	uniq,
	type RxNostrUseOptions
} from 'rx-nostr';
import { tap, type Subscription } from 'rxjs';
import { minTimelineLength } from '$lib/Constants';
import { unique } from '$lib/Array';
import { Channel } from '$lib/Channel';
import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
import type { ChannelMetadata } from '$lib/Types';

function contentRelays(event: Event | undefined): string[] {
	if (event === undefined) {
		return [];
	}
	try {
		const content = JSON.parse(event.content);
		return Array.isArray(content.relays)
			? content.relays.filter((relay: unknown): relay is string => typeof relay === 'string')
			: [];
	} catch {
		return [];
	}
}

export class ChannelChat {
	metadata = $state<ChannelMetadata>();
	creatorPubkey = $state<string>();
	messages = $state.raw<Event[]>([]);
	loading = $state(false);
	reachedStart = $state(false);

	shift = $state(false);

	liveSeq = $state(0);

	readonly #channelId: string;
	readonly #useOptions: RxNostrUseOptions;
	readonly #seen = new Set<string>();
	readonly #latestKind41ByAuthor = new Map<string, Event>();

	#kind40: Event | undefined;
	#liveSubscription: Subscription | undefined;
	#metadataSubscription: Subscription | undefined;

	constructor(channelId: string, relays: string[], kind40?: Event, kind41?: Event) {
		this.#channelId = channelId;
		this.#kind40 = kind40;
		if (kind41 !== undefined) {
			this.#latestKind41ByAuthor.set(kind41.pubkey, kind41);
		}
		this.#useOptions = {
			on: {
				defaultReadRelays: true,
				relays: unique(
					[...relays, ...contentRelays(kind40), ...contentRelays(kind41)].filter(
						(relay) => relay.startsWith('wss://')
					)
				)
			}
		};
		this.#resolveMetadata();
	}

	get channelId(): string {
		return this.#channelId;
	}

	async start(): Promise<void> {
		this.#fetchMetadata();
		this.#subscribeLive();
		await this.loadOlder();
	}

	async loadOlder(): Promise<void> {
		if (this.loading || this.reachedStart) {
			return;
		}
		this.loading = true;

		const until = this.messages.length > 0 ? this.messages[0].created_at : now();
		const collected: Event[] = [];
		const { promise, resolve } = Promise.withResolvers<void>();
		const req = createRxBackwardReq();
		rxNostr
			.use(req, this.#useOptions)
			.pipe(
				tie,
				uniq(),
				tap(({ event }) => referencesReqEmit(event))
			)
			.subscribe({
				next: ({ event }) => {
					if (!this.#seen.has(event.id)) {
						collected.push(event);
					}
				},
				complete: () => resolve(),
				error: () => resolve()
			});
		req.emit([
			{ kinds: [ChannelMessage], '#e': [this.#channelId], until, limit: minTimelineLength }
		]);
		req.over();
		await promise;

		if (collected.length === 0) {
			this.reachedStart = true;
		} else {
			this.#prependHistory(collected);
		}
		this.loading = false;
	}

	dispose(): void {
		this.#liveSubscription?.unsubscribe();
		this.#metadataSubscription?.unsubscribe();
	}

	#fetchMetadata(): void {
		const req = createRxOneshotReq({
			filters: [
				...(this.#kind40 === undefined
					? [{ kinds: [ChannelCreation], ids: [this.#channelId] }]
					: []),
				{ kinds: [ChannelMetadataKind], '#e': [this.#channelId] }
			]
		});
		this.#metadataSubscription = rxNostr
			.use(req, this.#useOptions)
			.pipe(tie, uniq())
			.subscribe(({ event }) => {
				if (event.kind === ChannelCreation) {
					this.#kind40 = event;
					referencesReqEmit(event);
				} else {
					const latest = this.#latestKind41ByAuthor.get(event.pubkey);
					if (latest === undefined || latest.created_at < event.created_at) {
						this.#latestKind41ByAuthor.set(event.pubkey, event);
					}
				}
				this.#resolveMetadata();
			});
	}

	#subscribeLive(): void {
		const req = createRxForwardReq();
		this.#liveSubscription = rxNostr
			.use(req, this.#useOptions)
			.pipe(
				tie,
				uniq(),
				tap(({ event }) => referencesReqEmit(event))
			)
			.subscribe(({ event }) => this.#appendLive(event));
		req.emit({ kinds: [ChannelMessage], '#e': [this.#channelId], since: now() });
	}

	#appendLive(event: Event): void {
		if (this.#seen.has(event.id)) {
			return;
		}
		this.#seen.add(event.id);
		this.shift = false;
		this.messages = [...this.messages, event];
		this.liveSeq++;
	}

	#prependHistory(events: Event[]): void {
		const fresh = events.filter((event) => !this.#seen.has(event.id));
		if (fresh.length === 0) {
			return;
		}
		for (const event of fresh) {
			this.#seen.add(event.id);
		}
		this.shift = true;
		this.messages = [...sortEvents([...fresh]).reverse(), ...this.messages];
	}

	#resolveMetadata(): void {
		if (this.#kind40 === undefined) {
			return;
		}
		this.creatorPubkey = this.#kind40.pubkey;
		const source = this.#latestKind41ByAuthor.get(this.#kind40.pubkey) ?? this.#kind40;
		this.metadata = Channel.parseMetadata(source);
	}
}
