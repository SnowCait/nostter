<script lang="ts">
	import type { Event } from 'nostr-typedef';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import { getListTitle } from '$lib/List';
	import IconList from '@tabler/icons-svelte/dist/svelte/icons/IconList.svelte';

	export let event: Event;

	$: title = getListTitle(event.tags);
	$: metadata = $metadataStore.get(event.pubkey);
</script>

<article class="timeline-item">
	<h1><IconList /> {title}</h1>
	<div>
		<span>by</span>
		{#if metadata?.picture !== undefined}
			<img src={metadata.picture} alt="" />
		{/if}
		<span>{metadata?.displayName ?? alternativeName(event.pubkey)}</span>
		{#if metadata?.displayName !== metadata?.name}
			<span>@{metadata?.name}</span>
		{/if}
	</div>
</article>

<style>
	h1 {
		height: 2rem;
		font-size: 2rem;
	}

	img {
		width: 1.2rem;
		height: 1.2rem;
		border-radius: 50%;
		object-fit: cover;
		vertical-align: bottom;
	}
</style>
