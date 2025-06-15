<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { localizedRelays, publicRelays } from '$lib/Constants';
	import { PublicTimeline, publicTimelines } from '$lib/timelines/PublicTimeline';
	import { EventItem } from '$lib/Items';
	import { onMount } from 'svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import { autoRefresh } from '$lib/stores/Preference';

	let timeline: PublicTimeline | undefined;

	let items: EventItem[] = [];

	onMount(() => {
		console.debug('[public timeline on mount]', $locale);
		if (publicTimelines.length > 0) {
			timeline = publicTimelines[0];
		} else {
			timeline = new PublicTimeline(
				$locale?.startsWith('ja') ? localizedRelays.ja.map(({ url }) => url) : publicRelays,
				$autoRefresh
			);
			timeline.subscribe();
			timeline.older();
			publicTimelines.push(timeline);
		}
		timeline.events.subscribe((events) => {
			items = events.map((event) => new EventItem(event));
		});
	});
</script>

<h1>{$_('pages.public')}</h1>

{#if timeline !== undefined}
	<Timeline {timeline} {items} />
{/if}
