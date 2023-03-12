<script lang="ts">
	import NoteView from './NoteView.svelte';
	import type { Event } from './types';
	export let events: Event[] = [];
	export let readonly: boolean = false;
</script>

<ul>
	{#each events as event}
		<li>
			<NoteView {event} {readonly} />
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		padding: 0;
		border: 1px solid rgb(239, 243, 244);
		border-bottom-style: none;
	}

	li {
		border-bottom: 1px solid rgb(239, 243, 244);
	}
</style>
