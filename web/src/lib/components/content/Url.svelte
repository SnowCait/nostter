<script lang="ts" module>
	import AsyncLock from 'async-lock';
	import { httpProxy, nicovideoRegexp } from '$lib/Constants';
	import {
		mediaKindFromContentType,
		mediaKindFromPathname,
		type MediaKind
	} from '$lib/media/MediaType';
	import { SvelteMap } from 'svelte/reactivity';

	declare global {
		interface Window {
			twttr: any; // eslint-disable-line @typescript-eslint/no-explicit-any
		}
	}

	const proxyRequiredOrigins = new Set<string>();
	const cache = new SvelteMap<string, string | null>();
	const lock = new AsyncLock();

	async function fetchContentType(url: string): Promise<string | null> {
		const origin = new URL(url).origin;
		return await lock.acquire(origin, async () => {
			if (cache.has(url)) {
				return cache.get(url) ?? null;
			}

			if (!proxyRequiredOrigins.has(origin)) {
				try {
					const response = await fetch(url, { method: 'HEAD' });
					const contentType = response.headers.get('Content-Type');
					cache.set(url, contentType);
					return contentType;
				} catch {
					proxyRequiredOrigins.add(origin);
				}
			}

			try {
				const response = await fetch(`${httpProxy}/?url=${encodeURIComponent(url)}`, {
					method: 'HEAD'
				});
				const contentType = response.headers.get('Content-Type');
				cache.set(url, contentType);
				return contentType;
			} catch {
				cache.set(url, null);
				return null;
			}
		});
	}
</script>

<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { newUrl } from '$lib/Helper';
	import { Spotify } from '$lib/Spotify';
	import { Twitter } from '$lib/Twitter';
	import { enablePreview } from '$lib/stores/Preference';
	import Text from './Text.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import SpotifyPlayer from '$lib/components/content/Spotify.svelte';
	import YouTube from '$lib/components/content/YouTube.svelte';
	import Nicovideo from './Nicovideo.svelte';
	import Video from './Video.svelte';
	import Thumbnail from './Thumbnail.svelte';

	interface Props {
		text: string;
		url?: string | undefined;
		urls?: URL[];
	}

	let { text, url = undefined, urls = [] }: Props = $props();

	let link = $derived(newUrl(url ?? text));
	let mediaKind = $derived(mediaKindFromPathname(link?.pathname ?? ''));
	let imageUrls = $derived(
		urls.filter(
			(url) =>
				mediaKindFromPathname(url.pathname) === 'image' ||
				cache.get(url.href)?.startsWith('image/')
		)
	);

	//#region Twitter Widget

	let twitterWidget: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (twitterWidget !== undefined) {
			console.debug('[twitter]', twitterWidget);
			window.twttr?.widgets.load(twitterWidget);
		}
	});

	//#endregion

	let preview = $state($enablePreview);
</script>

{#snippet showMore(link: URL)}
	<ExternalLink {link} />
	<button onclick={() => (preview = true)}>{$_('content.show')}</button>
{/snippet}

{#snippet media(link: URL, kind: MediaKind)}
	{#if preview}
		{#if kind === 'image'}
			<div>
				<Thumbnail url={link} urls={imageUrls} />
			</div>
		{:else if kind === 'audio'}
			<audio src={link.href} controls></audio>
		{:else}
			<Video url={link} />
		{/if}
	{:else}
		{@render showMore(link)}
	{/if}
{/snippet}

{#if link === undefined}
	<Text {text} />
{:else if link.protocol === 'http:'}
	<ExternalLink {link} />
{:else if Twitter.isTweetUrl(link)}
	{#if preview}
		<div class="twitter-widget" bind:this={twitterWidget}>
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
		{@render showMore(link)}
	{/if}
{:else if Spotify.isSpotifyUrl(link)}
	{#if preview}
		<SpotifyPlayer {link} />
	{:else}
		<ExternalLink {link} />
	{/if}
{:else if (link.hostname === 'youtu.be' || /^(.+\.)*youtube\.com$/s.test(link.hostname)) && !link.pathname.startsWith('/@')}
	<YouTube {link} />
{:else if link.hostname.endsWith('nicovideo.jp') && nicovideoRegexp.test(link.href)}
	<Nicovideo {link} />
{:else if link.hostname === 'amzn.to' || link.hostname === 'amzn.asia' || /^(.+\.)*amazon\.co\.jp$/s.test(link.hostname)}
	<ExternalLink {link} />
{:else if mediaKind !== undefined}
	{@render media(link, mediaKind)}
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
		{:else}
			{@const kind = mediaKindFromContentType(contentType)}
			{#if kind !== undefined}
				{@render media(link, kind)}
			{:else if url !== undefined && text !== url}
				<ExternalLink {link}>{text}</ExternalLink>
			{:else}
				<ExternalLink {link} />
			{/if}
		{/if}
	{:catch}
		<ExternalLink {link} />
	{/await}
{/if}

<style>
	.twitter-widget {
		width: 100%;
		max-width: 100%;
		overflow: hidden;
	}

	.twitter-widget :global(.twitter-tweet),
	.twitter-widget :global(iframe) {
		max-width: 100%;
	}

	.twitter-widget :global(iframe) {
		display: block;
	}
</style>
