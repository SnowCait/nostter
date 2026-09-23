<script lang="ts">
	import { Api } from '$lib/Api';
	import TimelineView from '../../../TimelineView.svelte';
	import { auth } from '$lib/auth.svelte';
	import {
		UserFollowingTimeline,
		currentPubkey,
		timelinesMap
	} from '$lib/timelines/UserFollowingTimeline.svelte';
	import { untrack } from 'svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let followees: string[] = $state([]);
	let timeline: UserFollowingTimeline | undefined = $state();

	$effect(() => {
		if (pubkey === $currentPubkey) {
			timeline = timelinesMap.get(pubkey);
		}
	});

	$effect(() => {
		if (pubkey !== $currentPubkey) {
			if ($currentPubkey !== undefined) {
				timeline = timelinesMap.get($currentPubkey);
				timeline?.unsubscribe();
			}
			$currentPubkey = pubkey;
			if (pubkey === auth.pubkey) {
				followees = auth.followees;
			} else {
				new Api().fetchFollowees(pubkey).then((pubkeys) => {
					followees = pubkeys;
				});
			}
		}
	});

	$effect(() => {
		if (followees.length > 0) {
			untrack(() => {
				console.debug(
					'[user following timeline]',
					pubkey,
					followees.length,
					timelinesMap.keys()
				);
				timeline = new UserFollowingTimeline(pubkey, followees);
				timeline.subscribe();
				timeline.load();
				timelinesMap.set(pubkey, timeline);
			});
		}
	});
</script>

{#if timeline !== undefined}
	<TimelineView
		items={timeline.items}
		readonly={auth.pubkey === undefined}
		load={timeline.load}
	/>
{/if}
