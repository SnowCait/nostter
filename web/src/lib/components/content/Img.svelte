<script lang="ts">
	import { followees } from '$lib/stores/Author';
	import { imageOptimization } from '$lib/stores/Preference';
	import type * as Nostr from 'nostr-typedef';
	import { getContext } from 'svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		url: URL;
	}

	let { url }: Props = $props();

	const { href: src, pathname } = $derived(url);
	const events = getContext<Nostr.Event[] | undefined>('events');
	const blur = events !== undefined && !events.some((event) => $followees.includes(event.pubkey));

	const optimize = $derived(
		$imageOptimization !== '' &&
			/\.(avif|jpg|jpeg|png|webp)$/i.test(pathname) &&
			!src.startsWith($imageOptimization)
	);

	// Writable $derived: reassigned on error/load, reset when url or preference changes
	let displaySrc = $derived(
		optimize ? `${$imageOptimization}width=800,quality=60,format=webp/${src}` : src
	);
	let loaded = $derived(!optimize);
</script>

<span class="img-wrapper">
	<img
		class:blur
		class:loading={!loaded}
		src={displaySrc}
		alt={src}
		loading="lazy"
		onload={() => (loaded = true)}
		onerror={() => {
			if (displaySrc !== src) {
				displaySrc = src;
			} else {
				loaded = true;
			}
		}}
	/>
	{#if blur}
		<button>{$_('content.show')}</button>
	{/if}
</span>

<style>
	img {
		max-width: calc(100% - 1.5em);
		max-height: 20em;
		margin: 0.5em;
		border: 1px solid lightgray;
		border-radius: 5px;
		vertical-align: middle;
	}

	img.blur {
		filter: blur(8px);
	}

	img.loading {
		opacity: 0;
	}

	.img-wrapper {
		position: relative;
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
