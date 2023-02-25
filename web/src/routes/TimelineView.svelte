<script lang="ts">
	import NoteView from './NoteView.svelte';
	import type { Timeline } from './types';
	export let timeline: Timeline;
</script>

<ul>
	{#each timeline.events as event}
		<li>
			<NoteView {event} user={timeline.users.get(event.pubkey)} />
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
