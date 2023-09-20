<script lang="ts">
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
	import { openNoteDialog } from '../stores/NoteDialog';
	import { onMount } from 'svelte';
	import { debugMode } from '../stores/Preference';
	import ReloadDialog from './ReloadDialog.svelte';
	import IconPencilPlus from '@tabler/icons-svelte/dist/svelte/icons/IconPencilPlus.svelte';
	import { pubkey, rom } from '../stores/Author';
	import { _ } from 'svelte-i18n';
	import '../app.css';

	let debugMessage = '';
	let reloadDialogComponent: ReloadDialog;

	function keyboardShortcut(event: KeyboardEvent) {
		console.debug(`[${event.type}]`, event.code, event.key, event.ctrlKey, event.metaKey);

		if (event.key === 'n') {
			$openNoteDialog = true;
		}

		if (event.key === '1') {
			scrollTo({
				top: 0,
				behavior: 'smooth'
			});
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
		<img src="/nostter-logo.svg" alt="nostter logo" width={120} height={24} />
		<Header />
		{#if $pubkey && !$rom}
			<button on:click={() => ($openNoteDialog = !$openNoteDialog)}>
				<IconPencilPlus size={30} />
				<p>{$_('post')}</p>
			</button>
		{/if}
	</header>

	<main>
		<slot />
	</main>
</div>

<style>
	.app {
		max-width: 800px;
		margin: 2.25rem auto;
	}

	header {
		position: fixed;
		/* min-width: 600px */
		top: 2.25rem;
		width: 220px;
		gap: 2.25rem;
		display: flex;
		flex-direction: column;
	}

	header button {
		width: inherit;
		height: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	main {
		margin-left: calc(220px + 2.25rem);
	}

	.debug {
		position: fixed;
		bottom: 0;
		background-color: white;
	}

	@media screen and (max-width: 600px) {
		.app {
			margin: 0 auto;
		}

		header {
			padding: 0;
			top: auto;
			bottom: 0;
			width: 100%;
			height: 50px;
			background-color: white;
		}

		header img {
			display: none;
		}

		header button {
			position: absolute;
			padding: 0;
			bottom: 55px;
			right: 10px;
			width: 50px;
			height: 50px;
			border-radius: 50%;
		}

		header button p {
			display: none;
		}

		main {
			margin-left: auto;
			margin-bottom: 50px;
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
		border: var(--default-border);
		border-radius: 5px;
		overflow: hidden;
	}

	:global(ul.clear) {
		list-style: none;
		padding: 0;
	}

	:global(button, input[type='button'], input[type='submit']) {
		padding: 0.75rem 1.5rem;
		border-radius: 9999px;
		background-color: var(--accent);
		color: var(--accent-foreground);
		font-weight: bold;
		cursor: pointer;
	}

	:global(button:hover, input[type='button']:hover, input[type='submit']:hover) {
		opacity: 0.75;
	}

	:global(
			button.button-small,
			input[type='button'].button-small,
			input[type='submit'].button-small
		) {
		padding: 0.2rem 0.85rem;
	}

	:global(
			input[type='text'],
			input[type='email'],
			input[type='number'],
			input[type='password'],
			input[type='search'],
			input[type='tel'],
			input[type='url'],
			textarea
		) {
		padding: 0.75rem;
		border: 1px solid var(--default-border);
		border-radius: 0.5rem;
		outline-style: none;
		background-color: var(--surface);
	}

	:global(button.clear) {
		background-color: transparent;
		border: none;
		cursor: pointer;
		outline: none;
		padding: 0;
		width: inherit;
		height: inherit;
	}

	:global(.card) {
		background-color: var(--surface);
		color: var(--surface-foreground);
		padding: 1rem;
		border-radius: 0.5rem;
		border: 2px solid var(--default-border);
	}
</style>
