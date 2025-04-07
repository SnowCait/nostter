<script lang="ts">
	import { Api } from '$lib/Api';
	import TimelineView from '../../TimelineView.svelte';
	import { pubkey as authorPubkey, followees as authorFollowees } from '$lib/stores/Author';
	import {
		UserFollowingTimeline,
		currentPubkey,
		timelinesMap
	} from '$lib/timelines/UserFollowingTimeline';

	export let pubkey: string;

	let followees: string[] = [];
	let timeline: UserFollowingTimeline | undefined;

	$: items = timeline?.items;

	$: if (pubkey === $currentPubkey) {
		timeline = timelinesMap.get(pubkey);
	}

	$: if (pubkey !== $currentPubkey) {
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

	$: if (followees.length > 0) {
		console.log('[user following timeline]', pubkey, followees.length, timelinesMap.keys());
		timeline = new UserFollowingTimeline(pubkey, followees);
		timeline.subscribe();
		timeline.load();
		timelinesMap.set(pubkey, timeline);
	}
</script>

<TimelineView
	items={$items ?? []}
	readonly={!$authorPubkey}
	load={async () => await timeline?.load()}
/>
