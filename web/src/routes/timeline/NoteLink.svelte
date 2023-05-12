<script lang="ts">
	import { nip19 } from 'nostr-tools';

	export let eventId: string;
</script>

<article class="timeline-item">
	<a href="/{nip19.noteEncode(eventId)}">
		{nip19.noteEncode(eventId).substring(0, 'note1'.length + 7)}
	</a>
</article>
