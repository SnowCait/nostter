<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { intentContent, openNoteDialog } from '../../stores/NoteDialog';
	import IconCodeDots from '@tabler/icons-svelte/dist/svelte/icons/IconCodeDots.svelte';
	import IconQuote from '@tabler/icons-svelte/dist/svelte/icons/IconQuote.svelte';

	export let naddr: string;
	export let event: Event;

	$: title = event.tags.find(([tagName]) => tagName === 'title')?.at(1);
	$: image = event.tags.find(([tagName]) => tagName === 'image')?.at(1);
	$: summary = event.tags.find(([tagName]) => tagName === 'summary')?.at(1);

	const iconSize = 20;
	let jsonDisplay = false;

	function quote() {
		$intentContent = `\nnostr:${naddr}`;
		$openNoteDialog = true;
	}

	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article class="timeline-item">
	<main>
		{#if image !== undefined}
			<img src={image} alt="" />
		{/if}
		<div class="content">
			<h1><a href="/{naddr}">{title}</a></h1>
			<p>{summary}</p>
			<div class="action-menu">
				<button on:click={quote}>
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
			<div>{naddr}</div>
			<h5>Event JSON</h5>
			<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
		</div>
	{/if}
</article>

<style>
	article {
		/* Workaround for unnecessary space */
		display: flex;
		flex-direction: column;
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

	h1 {
		font-size: 1.5em;
		margin-block-start: 0.3em;
		margin-block-end: 0.3em;
	}

	.content {
		margin: 1em;
		width: 100%;
	}

	.action-menu {
		display: flex;
		justify-content: space-between;
		margin-top: 12px;
		margin-left: 50%;
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
