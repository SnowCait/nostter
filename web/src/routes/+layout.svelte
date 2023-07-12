<script lang="ts">
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
	import { onMount } from 'svelte';
	import { debugMode } from '../stores/Preference';
	import ReloadDialog from './ReloadDialog.svelte';
	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';
	import NoteEditor from './NoteEditor.svelte';
	import IconPencilPlus from '@tabler/icons-svelte/dist/svelte/icons/IconPencilPlus.svelte';
	import { pubkey, rom } from '../stores/Author';

	inject({ mode: dev ? 'development' : 'production' });

	let enableNoteEditor = false;
	let debugMessage = '';
	let reloadDialogComponent: ReloadDialog;

	function keyboardShortcut(event: KeyboardEvent) {
		console.debug(
			`[${event.type}]`,
			event.code,
			event.key,
			event.ctrlKey,
			event.metaKey,
			event
		);

		if (event.key === 'n' && !enableNoteEditor) {
			enableNoteEditor = true;
		}

		if (event.key === 'Escape') {
			enableNoteEditor = false;
		}
	}

	function onVisibilityChange() {
		console.log('[visibilitychange]', document.visibilityState);
		debugMessage += `${new Date().toLocaleTimeString()} [visibilitychange] ${
			document.visibilityState
		}\n`;
		switch (document.visibilityState) {
			case 'hidden': {
				break;
			}
			case 'visible': {
				reloadDialogComponent.tryOpen();
				break;
			}
		}
	}

	onMount(() => {
		document.addEventListener('visibilitychange', onVisibilityChange);
	});
</script>

<svelte:window on:keyup={keyboardShortcut} />

<div class="app">
	<NoteDialog />
	<ReloadDialog bind:this={reloadDialogComponent} />

	{#if $debugMode}
		<section class="debug">
			<pre>{debugMessage}</pre>
		</section>
	{/if}

	<header>
		<Header />
		{#if $pubkey && !$rom}
			<button on:click={() => (enableNoteEditor = !enableNoteEditor)}>
				<IconPencilPlus size={30} />
			</button>
		{/if}
	</header>

	<main>
		{#if enableNoteEditor}
			<NoteEditor on:close={() => (enableNoteEditor = false)} />
		{/if}
		<slot />
	</main>
</div>

<style>
	.app {
		max-width: 800px;
		margin: 0 auto;
	}

	header {
		position: fixed;

		/* min-width: 600px */
		top: 0;
		width: 50px;
	}

	header button {
		background-color: transparent;
		border: none;
		cursor: pointer;
		outline: none;
		padding: 0;
		width: inherit;
		height: inherit;
	}

	main {
		margin-left: 60px;
	}

	.debug {
		position: fixed;
		bottom: 0;
		background-color: white;
	}

	@media screen and (max-width: 600px) {
		header {
			top: auto;
			bottom: 0;
			width: 100%;
			height: 50px;
			background-color: white;
		}

		header button {
			position: absolute;
			bottom: 55px;
			right: 10px;
			width: 50px;
			height: 50px;
			background-color: white;
			border-radius: 50%;
			box-shadow: 0 0 5px 1px lightgray;
		}

		main {
			margin-left: auto;
		}

		.debug {
			bottom: 50px;
			overflow: auto;
		}
	}

	:global(article.timeline-item) {
		padding: 12px 16px;
		font-family: 'Segoe UI', Meiryo, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
	}

	:global(article.timeline-item + article.timeline-item) {
		padding-top: 0;
	}

	:global(blockquote) {
		margin: 0.5em 0;
		border: 1px solid rgb(239, 243, 244);
		border-radius: 5px;
		overflow: hidden;
	}

	:global(.note-editor + .timeline) {
		border-top: none;
	}

	:global(:root) {
		--border: 1px solid rgb(239, 243, 244);
	}
</style>
