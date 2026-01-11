<script lang="ts">
	import { run } from 'svelte/legacy';

	import { Api } from '$lib/Api';
	import TimelineView from '../../TimelineView.svelte';
	import { pubkey as authorPubkey, followees as authorFollowees } from '$lib/stores/Author';
	import {
		UserFollowingTimeline,
		currentPubkey,
		timelinesMap
	} from '$lib/timelines/UserFollowingTimeline';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let followees: string[] = $state([]);
	let timeline: UserFollowingTimeline | undefined = $state();

	let items = $derived(timeline?.items);

	run(() => {
		if (pubkey === $currentPubkey) {
			timeline = timelinesMap.get(pubkey);
		}
	});

	run(() => {
		if (pubkey !== $currentPubkey) {
			if ($currentPubkey !== undefined) {
				timeline = timelinesMap.get($currentPubkey);
				timeline?.unsubscribe();
			}
			$currentPubkey = pubkey;
			if (pubkey === $authorPubkey) {
				followees = $authorFollowees;
			} else {
				new Api().fetchFollowees(pubkey).then((pubkeys) => {
					followees = pubkeys;
				});
			}
		}
	});

	run(() => {
		if (followees.length > 0) {
			console.log('[user following timeline]', pubkey, followees.length, timelinesMap.keys());
			timeline = new UserFollowingTimeline(pubkey, followees);
			timeline.subscribe();
			timeline.load();
			timelinesMap.set(pubkey, timeline);
		}
	});
</script>

<TimelineView
	items={$items ?? []}
	readonly={!$authorPubkey}
	load={async () => await timeline?.load()}
/>
