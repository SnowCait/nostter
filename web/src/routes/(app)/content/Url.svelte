<script lang="ts" context="module">
	declare global {
		interface Window {
			twttr: any;
		}
	}
</script>

<script lang="ts">
	import { ObserverRender } from '@svelteuidev/core';
	import { _ } from 'svelte-i18n';
	import { enablePreview } from '../../../stores/Preference';
	import Text from './Text.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';

	export let text: string;
	export let url: string = text;

	let link: URL | undefined;
	try {
		link = new URL(url);
	} catch (error) {
		console.log('[invalid url]', url, error);
	}

	let twitterWidget: HTMLDivElement | undefined;

	$: if (twitterWidget !== undefined) {
		console.debug('[twitter]', twitterWidget);
		window.twttr?.widgets.load(twitterWidget);
	}

	let preview = $enablePreview;
</script>

{#if link === undefined}
	<Text {text} />
{:else if link.origin === 'https://twitter.com' || link.origin === 'https://x.com'}
	<ObserverRender let:visible options={{ unobserveOnEnter: true }}>
		{#if preview && visible}
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
			<ExternalLink {link}>{text}</ExternalLink>
			<button on:click={() => (preview = true)}>{$_('content.show')}</button>
		{/if}
	</ObserverRender>
{:else if /\.(apng|avif|gif|jpg|jpeg|png|webp|bmp)$/i.test(link.pathname)}
	{#if preview}
		<div>
			<a href={link.href} target="_blank" rel="noopener noreferrer">
				<img src={link.href} alt="" />
			</a>
		</div>
	{:else}
		<ExternalLink {link}>{text}</ExternalLink>
		<button on:click={() => (preview = true)}>{$_('content.show')}</button>
	{/if}
{:else if /\.(mp3|m4a|wav)$/i.test(link.pathname)}
	{#if preview}
		<audio src={link.href} controls />
	{:else}
		<ExternalLink {link}>{text}</ExternalLink>
		<button on:click={() => (preview = true)}>{$_('content.show')}</button>
	{/if}
{:else if /\.(mp4|ogg|webm|ogv|mov|mkv|avi|m4v)$/i.test(link.pathname)}
	{#if preview}
		<!-- svelte-ignore a11y-media-has-caption -->
		<div>
			<video src={link.href} controls />
		</div>
	{:else}
		<ExternalLink {link}>{text}</ExternalLink>
		<button on:click={() => (preview = true)}>{$_('content.show')}</button>
	{/if}
{:else}
	<ExternalLink {link}>{text}</ExternalLink>
{/if}

<style>
	img,
	video {
		max-width: calc(100% - 1.5em);
		max-height: 20em;
		margin: 0.5em;
	}

	img {
		border: 1px solid lightgray;
		border-radius: 5px;
		vertical-align: middle;
	}
</style>
