<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { createRxOneshotReq, latestEach, uniq } from 'rx-nostr';
	import { bufferWhen, interval } from 'rxjs';
	import { _ } from 'svelte-i18n';
	import TimelineView from '../../TimelineView.svelte';
	import { appName } from '$lib/Constants';
	import { Metadata } from '$lib/Items';
	import type { LayoutData } from '../$types';
	import { metadataReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { metadataStore } from '$lib/cache/Events';
	import FollowAllButton from '$lib/components/actions/FollowAllButton.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	let pubkeys = new SvelteSet<string>();

	let items = $derived(
		[...pubkeys].map((pubkey) => $metadataStore.get(pubkey) ?? Metadata.placeholder(pubkey))
	);

	$effect(() => {
		const targetPubkey = data.pubkey;

		console.log('[followers page]', nip19.npubEncode(targetPubkey));
		pubkeys.clear();

		const contactsReq = createRxOneshotReq({
			filters: [
				{
					kinds: [3],
					'#p': [targetPubkey]
				}
			]
		});
		const subscription = rxNostr
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
				metadataReqEmit(packets.map((x) => x.event.pubkey));
			});

		return () => {
			subscription.unsubscribe();
		};
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
