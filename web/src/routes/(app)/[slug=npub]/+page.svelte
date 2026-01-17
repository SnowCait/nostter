<script lang="ts">
	import { page } from '$app/state';
	import { nip05 } from 'nostr-tools';
	import { createRxOneshotReq, now, uniq } from 'rx-nostr';
	import { tap } from 'rxjs';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { metadataStore, storeMetadata } from '$lib/cache/Events';
	import { metadataReqEmit, referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { Timeline } from '$lib/Timeline';
	import { EventItem } from '$lib/Items';
	import { minTimelineLength } from '$lib/Constants';
	import { replaceableEvents, replaceableEventsReqEmit } from '$lib/Profile';
	import type { LayoutProps } from './$types';
	import { developerMode } from '$lib/stores/Preference';
	import Profile from './Profile.svelte';
	import TimelineView from '../TimelineView.svelte';

	let { data }: LayoutProps = $props();

	let metadata = $derived($metadataStore.get(data.pubkey));

	let items = $state<EventItem[]>([]);
	let slug = $derived(page.params.slug!);

	afterNavigate(() => {
		console.debug('[npub page]', data.pubkey);

		items = [];

		if (metadata === undefined) {
			if (data.metadataEvent !== undefined) {
				storeMetadata(data.metadataEvent);
			} else {
				metadataReqEmit([data.pubkey]);
			}
		} else {
			referencesReqEmit(metadata.event);
			overwriteSlug();
		}

		if ($developerMode) {
			$replaceableEvents.clear();
			$replaceableEvents = $replaceableEvents;
			replaceableEventsReqEmit(data.pubkey);
		}
	});

	function overwriteSlug() {
		if (metadata?.content === undefined) {
			return;
		}

		const normalizedNip05 = metadata.normalizedNip05;
		if (normalizedNip05 === '' || slug === normalizedNip05) {
			return;
		}

		nip05.queryProfile(normalizedNip05).then((pointer) => {
			if (pointer !== null) {
				replaceState(`/${normalizedNip05}`, {});
				slug = normalizedNip05;
			} else {
				console.warn('[invalid NIP-05]', normalizedNip05);
			}
		});
	}

	async function load() {
		console.debug('[npub page timeline load]', data.pubkey);

		let firstLength = items.length;
		let count = 0;
		let until =
			items.length > 0 ? Math.min(...items.map((item) => item.event.created_at)) : now();
		let seconds = 12 * 60 * 60;

		while (items.length - firstLength < minTimelineLength && count < 10) {
			const since = until - seconds;
			console.debug(
				'[rx-nostr user timeline period]',
				new Date(since * 1000),
				new Date(until * 1000)
			);

			const filters = Timeline.createChunkedFilters([data.pubkey], since, until);
			console.debug('[rx-nostr user timeline REQ]', filters, rxNostr.getAllRelayStatus());
			const pastEventsReq = createRxOneshotReq({ filters });
			console.debug('[rx-nostr user timeline req ID]', pastEventsReq);
			await new Promise<void>((resolve, reject) => {
				rxNostr
					.use(pastEventsReq)
					.pipe(
						tie,
						uniq(),
						tap(({ event }) => {
							referencesReqEmit(event);
							authorActionReqEmit(event);
						})
					)
					.subscribe({
						next: (packet) => {
							console.debug('[rx-nostr user timeline packet]', packet);
							if (
								!(
									since <= packet.event.created_at &&
									packet.event.created_at < until
								)
							) {
								console.warn(
									'[rx-nostr user timeline out of period]',
									packet,
									since,
									until
								);
								return;
							}
							if (items.some((x) => x.event.id === packet.event.id)) {
								console.warn('[rx-nostr user timeline duplicate]', packet.event);
								return;
							}
							const item = new EventItem(packet.event);
							const index = items.findIndex(
								(x) => x.event.created_at < item.event.created_at
							);
							if (index < 0) {
								items.push(item);
							} else {
								items.splice(index, 0, item);
							}
							items = items;
						},
						complete: () => {
							console.debug(
								'[rx-nostr user timeline complete]',
								pastEventsReq.rxReqId
							);
							resolve();
						},
						error: (error) => {
							reject(error);
						}
					});
			});

			until -= seconds;
			seconds *= 2;
			count++;
			console.debug(
				'[rx-nostr user timeline loaded]',
				pastEventsReq.rxReqId,
				count,
				until,
				seconds / 3600,
				items.length
			);
		}
	}
</script>

<section class="card profile-wrapper">
	<Profile {slug} pubkey={data.pubkey} {metadata} relays={data.relays} />
</section>

<section>
	<TimelineView {items} readonly={!$authorPubkey} {load} />
</section>

<style>
	.profile-wrapper {
		position: relative;
	}

	section + section {
		margin-top: 1rem;
	}

	@media screen and (max-width: 600px) {
		section + section {
			margin-top: 0;
		}
	}
</style>
