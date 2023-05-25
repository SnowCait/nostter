<script lang="ts">
	import { Content } from '$lib/Content';
	import type { Event } from 'nostr-tools';
	import ReferenceNip27 from './ReferenceNip27.svelte';
	import Reference from './Reference.svelte';
	import Hashtag from './Hashtag.svelte';
	import Url from './Url.svelte';
	import Text from './Text.svelte';
	import CustomEmoji from './CustomEmoji.svelte';

	export let event: Event;
</script>

<p class="content">
	{#each Content.parse(event.content, event.tags) as token}
		{#if token.name === 'reference' && token.index === undefined}
			<ReferenceNip27 text={token.text} />
		{:else if token.name === 'reference' && token.index !== undefined && event.tags.at(token.index) !== undefined}
			<Reference text={token.text} tag={event.tags[token.index]} />
		{:else if token.name === 'hashtag'}
			<Hashtag text={token.text} />
		{:else if token.name === 'emoji' && token.url !== undefined}
			<CustomEmoji text={token.text} url={token.url} />
		{:else if token.name === 'url'}
			<Url text={token.text} />
		{:else if token.name === 'nip'}
			<Url
				text={token.text}
				url="https://github.com/nostr-protocol/nips/blob/master/{token.text.substring(
					'NIP-'.length
				)}.md"
			/>
		{:else}
			<Text text={token.text} />
		{/if}
	{/each}
</p>

<style>
	.content {
		line-height: 20px;
		max-height: 30em;
		overflow: auto;
		margin: 5px 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
