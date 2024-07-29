<script lang="ts">
	import type { Event } from 'nostr-typedef';
	import { getListTitle } from '$lib/List';
	import IconList from '@tabler/icons-svelte/icons/list';
	import OnelineProfile from '../profile/OnelineProfile.svelte';

	export let event: Event;

	$: title = getListTitle(event.tags);
</script>

<article class="timeline-item">
	<h1><IconList /> {title}</h1>
	<div>
		<span>by</span>
		<OnelineProfile pubkey={event.pubkey} />
	</div>
</article>

<style>
	h1 {
		height: 2rem;
		font-size: 2rem;
	}
</style>
