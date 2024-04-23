<script lang="ts">
	import { Content } from '$lib/Content';
	import { newUrl } from '$lib/Helper';
	import ReferenceNip27 from './ReferenceNip27.svelte';
	import Reference from './Reference.svelte';
	import Hashtag from './Hashtag.svelte';
	import Url from './Url.svelte';
	import Text from './Text.svelte';
	import CustomEmoji from './CustomEmoji.svelte';
	import Ogp from './Ogp.svelte';
	import { enablePreview } from '../../../stores/Preference';

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
	{#each urls as url}
		{#if $enablePreview}
			{#if url.origin === 'https://twitter.com' || url.origin === 'https://x.com'}
				<!-- Twitter -->
			{:else if url.hostname === 'youtu.be' || /^(.+\.)*youtube\.com$/s.test(url.hostname)}
				<!-- YouTube -->
			{:else if /\.(apng|avif|gif|jpg|jpeg|png|webp|bmp|mp3|m4a|wav|mp4|ogg|webm|ogv|mov|mkv|avi|m4v)$/i.test(url.pathname)}
				<!-- Media -->
			{:else}
				<Ogp {url} />
			{/if}
		{/if}
	{/each}
</p>

<style>
	.content {
		line-height: 20px;
		margin: 0;
		white-space: pre-line;
		word-break: break-word;
	}
</style>
