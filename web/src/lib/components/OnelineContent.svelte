<script lang="ts">
	import { Content } from '$lib/Content';
	import Hashtag from './content/Hashtag.svelte';
	import Url from './content/Url.svelte';
	import CustomEmoji from './content/CustomEmoji.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import OnelineText from './content/OnelineText.svelte';
	import ReferenceNip27 from './content/ReferenceNip27.svelte';

	export let content: string;
	export let tags: string[][];

	$: tokens = Content.parse(content.split('\n')[0], tags);
</script>

<p class="content">
	{#each tokens as token}
		{#if token.name === 'reference' && token.index === undefined}
			{#if token.text.startsWith('nostr:npub1') || token.text.startsWith('nostr:nprofile1')}
				<ReferenceNip27 text={token.text} />
			{:else}
				{@const protocolLength = 'nostr:'.length}
				{@const prefixLength = token.text.indexOf('1') + 1}
				<a href="/{token.text.substring(protocolLength)}">
					{token.text.substring(protocolLength, prefixLength + 7)}
				</a>
			{/if}
		{:else if token.name === 'reference' && token.index !== undefined && tags.at(token.index) !== undefined}
			<!-- <Reference text={token.text} tag={tags[token.index]} /> -->
		{:else if token.name === 'hashtag'}
			<Hashtag text={token.text} />
		{:else if token.name === 'emoji' && token.url !== undefined}
			<CustomEmoji text={token.text} url={token.url} />
		{:else if token.name === 'url' && URL.canParse(token.text)}
			<ExternalLink link={new URL(token.text)}>{token.text}</ExternalLink>
		{:else if token.name === 'relay'}
			<a href="/relays/{encodeURIComponent(token.text)}">
				{token.text}
			</a>
		{:else if token.name === 'nip'}
			<Url
				text={token.text}
				url="https://github.com/nostr-protocol/nips/blob/master/{token.text.substring(
					'NIP-'.length
				)}.md"
			/>
		{:else}
			<OnelineText text={token.text} />
		{/if}
	{/each}
</p>

<style>
	.content {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		text-wrap: nowrap;
	}
</style>
