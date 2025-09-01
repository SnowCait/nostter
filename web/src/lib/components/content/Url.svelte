<script lang="ts" context="module">
	import AsyncLock from 'async-lock';
	import { httpProxy, nicovideoRegexp } from '$lib/Constants';

	declare global {
		interface Window {
			twttr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
		}
	}

	const cache = new Map<string, string | null>();
	const lock = new AsyncLock();

	async function fetchContentType(url: string): Promise<string | null> {
		return await lock.acquire(url, async () => {
			if (cache.has(url)) {
				return cache.get(url) ?? null;
			}
			const response = await fetch(`${httpProxy}/?url=${encodeURIComponent(url)}`, {
				method: 'HEAD'
			});
			const contentType = response.headers.get('Content-Type');
			cache.set(url, contentType);
			return contentType;
		});
	}
</script>

<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { newUrl } from '$lib/Helper';
	import { Twitter } from '$lib/Twitter';
	import { enablePreview } from '$lib/stores/Preference';
	import Text from './Text.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import YouTube from '$lib/components/content/YouTube.svelte';
	import Img from '$lib/components/content/Img.svelte';
	import Nicovideo from './Nicovideo.svelte';
	import Video from './Video.svelte';

	export let text: string;
	export let url: string | undefined = undefined;

	$: link = newUrl(url ?? text);

	let twitterWidget: HTMLDivElement | undefined;

	$: if (twitterWidget !== undefined) {
		console.debug('[twitter]', twitterWidget);
		window.twttr?.widgets.load(twitterWidget);
	}

	let preview = $enablePreview;
</script>

{#if link === undefined}
	<Text {text} />
{:else if Twitter.isTweetUrl(link)}
	{#if preview}
		<div bind:this={twitterWidget}>
			<blockquote class="twitter-tweet">
				<a
					href={link.href.replace('x.com', 'twitter.com')}
					target="_blank"
					rel="noopener noreferrer"
				>
					{link.href}
				</a>
			</blockquote>
		</div>
	{:else}
		<ExternalLink {link} />
		<button on:click={() => (preview = true)}>{$_('content.show')}</button>
	{/if}
{:else if link.hostname === 'youtu.be' || /^(.+\.)*youtube\.com$/s.test(link.hostname)}
	<YouTube {link} />
{:else if link.hostname.endsWith('nicovideo.jp') && nicovideoRegexp.test(link.href)}
	<Nicovideo {link} />
{:else if link.hostname === 'amzn.to' || link.hostname === 'amzn.asia' || /^(.+\.)*amazon\.co\.jp$/s.test(link.hostname)}
	<ExternalLink {link} />
{:else}
	{#await fetchContentType(link.href)}
		{#if url !== undefined && text !== url}
			<ExternalLink {link}>{text}</ExternalLink>
		{:else}
			<ExternalLink {link} />
		{/if}
	{:then contentType}
		{#if contentType === null}
			<ExternalLink {link} />
		{:else if contentType.startsWith('image/')}
			{#if preview}
				<div>
					<a href={link.href} target="_blank" rel="noopener noreferrer">
						<Img url={link} />
					</a>
				</div>
			{:else}
				<ExternalLink {link} />
				<button on:click={() => (preview = true)}>{$_('content.show')}</button>
			{/if}
		{:else if contentType.startsWith('audio/')}
			{#if preview}
				<audio src={link.href} controls />
			{:else}
				<ExternalLink {link} />
				<button on:click={() => (preview = true)}>{$_('content.show')}</button>
			{/if}
		{:else if contentType.startsWith('video/')}
			{#if preview}
				<Video url={link} />
			{:else}
				<ExternalLink {link} />
				<button on:click={() => (preview = true)}>{$_('content.show')}</button>
			{/if}
		{:else if url !== undefined && text !== url}
			<ExternalLink {link}>{text}</ExternalLink>
		{:else}
			<ExternalLink {link} />
		{/if}
	{:catch}
		<ExternalLink {link} />
	{/await}
{/if}
