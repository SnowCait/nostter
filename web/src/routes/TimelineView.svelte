<script lang="ts">
	import NoteView from './NoteView.svelte';
	import { events } from '../stores/Events';
	export let readonly: boolean = false;
	export let repost: Function;
	export let reaction: Function;
</script>

<ul>
	{#each $events as event}
		<li>
			<NoteView {event} {readonly} {repost} {reaction} />
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
