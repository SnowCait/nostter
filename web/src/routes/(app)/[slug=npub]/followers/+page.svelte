<script lang="ts">
	import { run } from 'svelte/legacy';

	import { nip19 } from 'nostr-tools';
	import { createRxOneshotReq, latestEach, uniq } from 'rx-nostr';
	import { bufferWhen, interval } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import TimelineView from '../../TimelineView.svelte';
	import { appName } from '$lib/Constants';
	import type { Metadata } from '$lib/Items';
	import type { LayoutData } from '../$types';
	import { metadataReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { metadataStore } from '$lib/cache/Events';
	import FollowAllButton from '$lib/components/actions/FollowAllButton.svelte';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let pubkey: string | undefined = $state();
	let pubkeys = $state(new Set<string>());

	let items = $derived([...pubkeys]
		.map((pubkey) => $metadataStore.get(pubkey))
		.filter((metadata): metadata is Metadata => metadata !== undefined));

	run(() => {
		if (pubkey !== data.pubkey && browser) {
			console.log('[followers page]', nip19.npubEncode(data.pubkey));
			pubkey = data.pubkey;

			const contactsReq = createRxOneshotReq({
				filters: [
					{
						kinds: [3],
						'#p': [data.pubkey]
					}
				]
			});
			rxNostr
				.use(contactsReq)
				.pipe(
					tie,
					uniq(),
					latestEach(({ event }) => event.pubkey),
					bufferWhen(() => interval(1000))
				)
				.subscribe((packets) => {
					console.log('[rx-nostr contacts]', packets);
					for (const {
						event: { pubkey }
					} of packets) {
						pubkeys.add(pubkey);
					}
					pubkeys = pubkeys;
					metadataReqEmit(packets.map((x) => x.event.pubkey));
				});
		}
	});
</script>

<svelte:head>
	<title>{appName} - {$_('pages.followers')}</title>
</svelte:head>

<div>
	<h1>{$_('pages.followers')} ({pubkeys.size}+)</h1>
	<FollowAllButton pubkeys={[...pubkeys]} />
</div>

<TimelineView {items} showLoading={false} />

<style>
	div {
		display: flex;
		justify-content: space-between;
		margin: 0.5rem auto;
	}
</style>
