<script lang="ts">
	import { browser } from '$app/environment';
	import { Content } from '$lib/Content';
	import ReferenceNip27 from './content/ReferenceNip27.svelte';
	import Reference from './content/Reference.svelte';
	import Hashtag from './content/Hashtag.svelte';
	import Url from './content/Url.svelte';
	import Text from './content/Text.svelte';
	import CustomEmojiPopup from './content/CustomEmojiPopup.svelte';
	import Ogp from './content/Ogp.svelte';
	import { enablePreview } from '$lib/stores/Preference';
	import { Twitter } from '$lib/Twitter';
	import { nicovideoRegexp } from '$lib/Constants';
	import type { Event } from 'nostr-typedef';

	interface Props {
		content: string;
		tags: string[][];
		event?: Event;
	}

	let { content, tags, event }: Props = $props();

	let tokens = $derived(Content.parse(content, tags));
	let urls = $derived(
		tokens
			.filter((token) => token.type === 'url' && URL.canParse(token.text))
			.map((token) => new URL(token.text))
			.filter((url) => url.protocol === 'https:')
	);
</script>

<p class="content">
	{#each tokens as token}
		{#if token.type === 'reference' && token.text.startsWith('nostr:')}
			<ReferenceNip27 text={token.text} />
		{:else if token.type === 'reference' && token.tagIndex !== undefined && tags.at(token.tagIndex) !== undefined}
			<Reference text={token.text} tag={tags[token.tagIndex]} />
		{:else if token.type === 'hashtag'}
			<Hashtag text={token.text} />
		{:else if token.type === 'emoji'}
			<CustomEmojiPopup text={token.text} url={token.url} address={token.address} {event} />
		{:else if token.type === 'url'}
			<Url text={token.text} />
		{:else if token.type === 'relay'}
			<a href="/relays/{encodeURIComponent(token.text)}">
				{token.text}
			</a>
		{:else if token.type === 'nip'}
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
			{#if Twitter.isTweetUrl(url)}
				<!-- Twitter -->
			{:else if (url.hostname === 'youtu.be' || /^(.+\.)*youtube\.com$/s.test(url.hostname)) && !url.pathname.startsWith('/@')}
				<!-- YouTube -->
			{:else if url.hostname.endsWith('nicovideo.jp') && nicovideoRegexp.test(url.href)}
				<!-- Niconico -->
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
