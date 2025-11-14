<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import { localizedRelays, publicRelays } from '$lib/Constants';
	import { PublicTimeline, publicTimelines } from '$lib/timelines/PublicTimeline';
	import { onMount } from 'svelte';
	import Timeline from '$lib/components/Timeline.svelte';

	let timeline: PublicTimeline | undefined;

	onMount(() => {
		console.debug('[public timeline on mount]', $locale);
		if (publicTimelines.length > 0) {
			timeline = publicTimelines[0];
		} else {
			timeline = new PublicTimeline(
				$locale?.startsWith('ja') ? localizedRelays.ja.map(({ url }) => url) : publicRelays
			);
			timeline.subscribe();
			timeline.older();
			publicTimelines.push(timeline);
		}
	});
</script>

<h1>{$_('pages.public')}</h1>

{#if timeline !== undefined}
	<Timeline {timeline} />
{/if}
