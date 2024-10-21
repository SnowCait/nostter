<script lang="ts">
	import { browser } from '$app/environment';
	import { Content } from '$lib/Content';
	import { newUrl } from '$lib/Helper';
	import ReferenceNip27 from './content/ReferenceNip27.svelte';
	import Reference from './content/Reference.svelte';
	import Hashtag from './content/Hashtag.svelte';
	import Url from './content/Url.svelte';
	import Text from './content/Text.svelte';
	import CustomEmoji from './content/CustomEmoji.svelte';
	import Ogp from './content/Ogp.svelte';
	import { enablePreview } from '$lib/stores/Preference';
	import Relay from './items/Relay.svelte';

	export let content: string;
	export let tags: string[][];

	$: tokens = Content.parse(content, tags);
	$: urls = tokens
		.filter((token) => token.name === 'url')
		.map((token) => token.text)
		.map((url) => newUrl(url))
		.filter((url): url is URL => url !== undefined);
</script>

<p class="content">
	{#each tokens as token}
		{#if token.name === 'reference' && token.index === undefined}
			<ReferenceNip27 text={token.text} />
		{:else if token.name === 'reference' && token.index !== undefined && tags.at(token.index) !== undefined}
			<Reference text={token.text} tag={tags[token.index]} />
		{:else if token.name === 'hashtag'}
			<Hashtag text={token.text} />
		{:else if token.name === 'emoji' && token.url !== undefined}
			<CustomEmoji text={token.text} url={token.url} />
		{:else if token.name === 'url'}
			<Url text={token.text} />
		{:else if token.name === 'relay'}
			<a href="/relay/{token.text}">
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
			<Text text={token.text} />
		{/if}
	{/each}
	{#if $enablePreview && browser}
		{#each urls as url}
			{#if url.origin === 'https://twitter.com' || url.origin === 'https://x.com'}
				<!-- Twitter -->
			{:else if url.hostname === 'youtu.be' || /^(.+\.)*youtube\.com$/s.test(url.hostname)}
				<!-- YouTube -->
			{:else if url.hostname === 'amzn.to' || url.hostname === 'amzn.asia' || /^(.+\.)*amazon\.co\.jp$/s.test(url.hostname)}
				<!-- Amazon -->
			{:else if /\.(apng|avif|gif|jpg|jpeg|png|webp|bmp|mp3|m4a|wav|mp4|ogg|webm|ogv|mov|mkv|avi|m4v)$/i.test(url.pathname)}
				<!-- Media -->
			{:else}
				<Ogp {url} />
			{/if}
		{/each}
	{/if}
</p>

<style>
	.content {
		margin: 0;
		white-space: pre-line;
		word-break: break-word;
	}
</style>
