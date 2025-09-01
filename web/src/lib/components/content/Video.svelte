<script lang="ts">
	import { followees } from '$lib/stores/Author';
	import type { Event } from 'nostr-typedef';
	import { getContext } from 'svelte';
	import { _ } from 'svelte-i18n';

	export let url: URL;

	const events = getContext<Event[] | undefined>('events');
	let blur = events !== undefined && !events.some((event) => $followees.includes(event.pubkey));

	function show(): void {
		blur = false;
	}
</script>

<div class="wrapper">
	<!-- svelte-ignore a11y-media-has-caption -->
	<video src={url.href} controls class:blur on:click={show} />
	{#if blur}
		<button class="description" on:click={show}>{$_('content.show')}</button>
	{/if}
</div>

<style>
	.wrapper {
		position: relative;
		display: inline-block;
	}

	video {
		max-width: calc(100% - 1.5em);
		max-height: 20em;
		margin: 0.5em;
	}

	.blur {
		filter: blur(8px);
	}

	button {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	button:hover {
		opacity: inherit;
	}
</style>
