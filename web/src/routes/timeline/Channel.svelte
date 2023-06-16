<script lang="ts">
	import { onMount } from 'svelte';
	import { Api } from '$lib/Api';
	import { nip19, type Event } from 'nostr-tools';
	import { pool } from '../../stores/Pool';
	import { readRelays } from '../../stores/Author';
	import type { ChannelMetadata } from '../types';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconQuote from '@tabler/icons-svelte/dist/svelte/icons/IconQuote.svelte';
	import { intentContent, openNoteDialog } from '../../stores/NoteDialog';

	export let event: Event;

	let { name, about, picture } = JSON.parse(event.content) as ChannelMetadata;
	console.log('[channel (kind 40)]', name, about, picture);

	const iconSize = 20;
	let jsonDisplay = false;

	function quote(event: Event) {
		$intentContent = '\n' + nip19.neventEncode({ id: event.id });
		$openNoteDialog = true;
	}

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};

	onMount(async () => {
		const api = new Api($pool, $readRelays);
		const metadataEvent = await api.fetchChannelMetadataEvent(event.id);

		if (metadataEvent === undefined) {
			return;
		}

		const metadata = JSON.parse(metadataEvent.content) as ChannelMetadata;
		name = metadata.name;
		about = metadata.about;
		picture = metadata.picture;
		console.log('[channel (kind 41)]', name, about, picture);
	});
</script>

<article class="timeline-item">
	<main>
		{#if picture}
			<img src={picture} alt="" />
		{/if}
		<div class="channel">
			<h1>{name}</h1>
			<div class="about">{about}</div>
			<div class="action-menu">
				<div>
					<a
						href="https://garnet.nostrian.net/channels/{event.id}"
						target="_blank"
						rel="noopener noreferrer"
					>
						Open in GARNET
					</a>
				</div>
				<button on:click={() => quote(event)}>
					<IconQuote size={iconSize} />
				</button>
				<button on:click={toggleJsonDisplay}>
					<IconCodeDots size={iconSize} />
				</button>
			</div>
		</div>
	</main>
	{#if jsonDisplay}
		<div class="develop">
			<h5>ID</h5>
			<div>{nip19.neventEncode({ id: event.id })}</div>
			<h5>Event JSON</h5>
			<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
		</div>
	{/if}
</article>

<style>
	article {
		/* Workaround for unnecessary space */
		display: flex;
	}

	article.timeline-item {
		padding: 0;
	}

	main {
		display: flex;
		width: 100%;
	}

	img {
		width: 30%;
		object-fit: cover;
	}

	.channel {
		margin: 1em;
		width: 100%;
	}

	.action-menu {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
	}

	.action-menu button {
		border: none;
		background-color: inherit;
		cursor: pointer;
		outline: none;
		padding: 0;
		color: lightgray;
		height: 20px;
	}

	.develop pre {
		background-color: #f6f8fa;
		padding: 0.5em;
		overflow: auto;
	}

	.develop .json {
		font-size: 0.8em;
	}
</style>
