<script lang="ts">
	import { IconExternalLink } from '@tabler/icons-svelte';
	import { nip19 } from 'nostr-tools';
	import { userEvents } from '../../stores/UserEvents';
	import Hashtag from './Hashtag.svelte';
	import Text from './Text.svelte';

	export let text: string;
	export let tag: string[];
</script>

{#if tag.at(0) === 'p' && tag.at(1) !== undefined}
	<a href="/{nip19.npubEncode(tag[1])}">
		@{$userEvents.has(tag[1]) && $userEvents.get(tag[1])?.user.name
			? $userEvents.get(tag[1])?.user.name
			: nip19.npubEncode(tag[1]).substring(0, 'npub1'.length + 7)}
	</a>
{:else if tag.at(0) === 'e' && tag.at(1) !== undefined}
	<a
		href="https://nostx.shino3.net/{nip19.noteEncode(tag[1])}"
		target="_blank"
		rel="noopener noreferrer"
	>
		{nip19.noteEncode(tag[1]).substring(0, 'note1'.length + 7)}<IconExternalLink size={15} />
	</a>
{:else if tag.at(0) === 'r' && tag.at(1) !== undefined}
	<a href={tag[1]}>
		{tag[1]}<IconExternalLink size={15} />
	</a>
{:else if tag.at(0) === 't' && tag.at(1) !== undefined}
	<Hashtag text={`#${tag[1]}`} />
{:else}
	<Text {text} />
{/if}
