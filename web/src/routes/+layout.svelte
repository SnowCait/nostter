<script lang="ts">
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
	import { openNoteDialog } from '../stores/NoteDialog';

	function keyboardShortcut(event: KeyboardEvent) {
		console.debug(`[${event.type}]`, event.code, event.key, event.ctrlKey, event.metaKey);

		if (event.key === 'n') {
			$openNoteDialog = true;
		}
	}
</script>

<svelte:window on:keyup={keyboardShortcut} />

<div class="app">
	<NoteDialog />

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
	}
</style>
