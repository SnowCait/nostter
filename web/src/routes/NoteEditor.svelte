<script lang="ts" context="module">
	import NoteEditorCore, { focusNoteEditor } from './NoteEditorCore.svelte';

	export async function openNoteEditor() {
		await focusNoteEditor();
	}
</script>

<script lang="ts">
	import IconPin from '@tabler/icons-svelte/dist/svelte/icons/IconPin.svelte';
	import IconPinnedFilled from '@tabler/icons-svelte/dist/svelte/icons/IconPinnedFilled.svelte';
	import IconX from '@tabler/icons-svelte/dist/svelte/icons/IconX.svelte';
	import { createEventDispatcher } from 'svelte';
	import { replyTo } from '../stores/NoteDialog';
	import Note from './timeline/Note.svelte';

	const dispatch = createEventDispatcher();

	let pinned = false;

	function close() {
		if (pinned) {
			return;
		}

		dispatch('close');
	}
</script>

<article class="note-editor">
	<header>
		<button on:click={() => (pinned = !pinned)}>
			{#if pinned}
				<IconPinnedFilled />
			{:else}
				<IconPin />
			{/if}
		</button>
		<button on:click={close}>
			<IconX />
		</button>
	</header>
	<main>
		{#if $replyTo}
			<Note event={$replyTo} readonly={true} />
		{/if}
		<NoteEditorCore on:sent={close} />
	</main>
</article>

<style>
	article {
		border: var(--border);
		padding: 12px 16px;
	}

	header {
		display: flex;
		flex-direction: row;
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

	button:first-child {
		margin-left: auto;
	}
</style>
