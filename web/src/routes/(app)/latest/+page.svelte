<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { appName, reverseChronologicalItem } from '$lib/Constants';
	import { EventItem } from '$lib/Items';
	import { lastNoteReqEmit } from '$lib/LastNotes';
	import { hasSubscribed, hometimelineReqEmit } from '$lib/timelines/HomeTimeline';
	import { metadataReqEmit } from '$lib/timelines/MainTimeline';
	import { followees } from '../../../stores/Author';
	import { lastNotesMap } from '../../../stores/LastNotes';
	import TimelineView from '../TimelineView.svelte';

	if ($followees.length > 0) {
		metadataReqEmit($followees);
		lastNoteReqEmit($followees);
		if (!hasSubscribed) {
			hometimelineReqEmit();
		}
	}

	$: items = [...$lastNotesMap]
		.map(([, event]) => new EventItem(event))
		.sort(reverseChronologicalItem);
</script>

<svelte:head>
	<title>{appName} - {$_('pages.latest')}</title>
</svelte:head>

<h1>{$_('pages.latest')}</h1>

<TimelineView {items} showLoading={false} />
