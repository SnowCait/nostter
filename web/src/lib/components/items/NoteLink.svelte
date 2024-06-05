<script lang="ts">
	import { nip19 } from 'nostr-tools';

	export let eventId: string;
</script>

<article class="timeline-item">
	<a href="/{nip19.neventEncode({ id: eventId })}">
		{nip19.neventEncode({ id: eventId }).substring(0, 'nevent1'.length + 7)}
	</a>
</article>
