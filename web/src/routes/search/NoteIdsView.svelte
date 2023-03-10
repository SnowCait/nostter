<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { events } from '../../stores/Events';

	let noteIds: string[] = [];

	function getNoteIds() {
		noteIds = $events.map((x) => nip19.noteEncode(x.id));
	}
</script>

<section>
	<form on:submit|preventDefault={getNoteIds}>
		<input type="submit" value="Get note IDs" />
	</form>
	{#if noteIds}
		<pre>{noteIds.join('\n')}</pre>
	{/if}
</section>
