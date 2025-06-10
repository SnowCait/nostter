<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { isNostrHex } from '$lib/EventHelper';
	import { developerMode } from '$lib/stores/Preference';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	export let eventId: string;

	$: nevent = nip19.neventEncode({ id: eventId, relays: getSeenOnRelays(eventId) });
</script>

<article class="timeline-item">
	{#if isNostrHex(eventId)}
		<a href="/{nevent}">
			{nevent.substring(0, 'nevent1'.length + 7)}
		</a>
	{:else}
		<div>{$_('content.not_found')}</div>
		{#if $developerMode}
			<div>{eventId}</div>
		{/if}
	{/if}
</article>
