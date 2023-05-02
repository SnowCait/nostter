<script lang="ts">
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
	import { openNoteDialog } from '../stores/NoteDialog';
	import { onMount } from 'svelte';
	import { debugMode } from '../stores/Preference';

	let debugMessage = '';

	function keyboardShortcut(event: KeyboardEvent) {
		console.debug(`[${event.type}]`, event.code, event.key, event.ctrlKey, event.metaKey);

		if (event.key === 'n') {
			$openNoteDialog = true;
		}
	}

	function onVisibilityChange(event: Event) {
		console.warn('[visibilitychange]', document.visibilityState);
		debugMessage += `${new Date().toLocaleTimeString()} [visibilitychange] ${
			document.visibilityState
		}\n`;
		switch (document.visibilityState) {
			case 'hidden': {
				break;
			}
			case 'visible': {
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

	{#if $debugMode}
		<section class="debug">
			<pre>{debugMessage}</pre>
		</section>
	{/if}

	<header>
		<Header />
	</header>

	<main>
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

		main {
			margin-left: auto;
		}

		.debug {
			bottom: 50px;
			overflow: auto;
		}
	}
</style>
