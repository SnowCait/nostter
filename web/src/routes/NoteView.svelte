<script lang="ts">
	import type { Event } from './types';
	import { pawPad } from '../stores/Preference';
	export let event: Event;
	export let readonly: boolean;
	export let repost: Function;
	export let reaction: Function;
	const regexImage = new RegExp('https?://.+\\.(apng|avif|gif|jpg|jpeg|png|webp|bmp)', 'g');
	const regexAudio = new RegExp('https?://.+\\.(mp3|m4a|wav)', 'g');
	const regexVideo = new RegExp('https?://.+\\.(mp4|ogg|webm|ogv|mov|mkv|avi|m4v)', 'g');
	let jsonDisplay = false;
	const toggleJsonDisplay = () => {
		jsonDisplay = !jsonDisplay;
	};
</script>

<article id={event.id}>
	<div>
		<a href="/p/{event.pubkey}">
			<img class="picture" src={event.user?.picture} alt="" />
		</a>
	</div>
	<div class="note">
		<div class="user">
			<span class="display_name">
				{event.user?.display_name ? event.user.display_name : event.user?.name}
			</span>
			<span class="name">@{event.user?.name}</span>
		</div>
		<pre class="content">{event.content}</pre>
		<ol class="media">
			{#each [...event.content.matchAll(regexImage)].map((x) => new URL(x[0])) as url}
				<li>
					<a href={url.href} target="_blank" rel="noreferrer">
						<img src={url.href} alt="" />
					</a>
				</li>
			{/each}
		</ol>
		<ol class="media">
			{#each [...event.content.matchAll(regexAudio)].map((x) => new URL(x[0])) as url}
				<li>
					<a href={url.href} target="_blank" rel="noreferrer">
						<audio src={url.href} controls />
					</a>
				</li>
			{/each}
		</ol>
		<ol class="media">
			{#each [...event.content.matchAll(regexVideo)].map((x) => new URL(x[0])) as url}
				<li>
					<a href={url.href} target="_blank" rel="noreferrer">
						<!-- svelte-ignore a11y-media-has-caption -->
						<video src={url.href} controls />
					</a>
				</li>
			{/each}
		</ol>
		<div class="created_at">{new Date(event.created_at * 1000)}</div>
		{#if !readonly}
			<div class="action-menu">
				<button on:click={() => repost(event)}>🔁</button>
				<button on:click={() => reaction(event)}>
					{#if $pawPad}🐾{:else}💖{/if}
				</button>
				<button on:click={toggleJsonDisplay}>{'{'} JSON {'}'}</button>
			</div>
		{/if}
		{#if jsonDisplay}
			<div class="develop">
				<h5>Event JSON</h5>
				<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
				<h5>User JSON</h5>
				<pre><code class="json">{JSON.stringify(event.user, null, 2)}</code></pre>
			</div>
		{/if}
	</div>
</article>

<style>
	article {
		padding: 12px 16px;
		display: flex;
		flex-direction: row;
	}

	.picture {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		margin-right: 12px;
	}

	.note {
		color: rgb(15, 20, 25);
		font-size: 15px;
		font-weight: 400;
		width: 100%;
	}

	.user {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		font-family: 'Segoe UI', Meiryo, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: rgb(83, 100, 113);
		font-size: 15px;
	}

	.content {
		line-height: 20px;
		max-height: 10em;
		overflow: auto;
		margin: 5px 0;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.media {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.media img {
		max-height: 20em;
		margin: 0.5em;
	}

	.created_at {
		color: gray;
		font-size: 0.5em;
	}

	.develop pre {
		background-color: #f6f8fa;
		padding: 0.5em;
		overflow: auto;
	}
	.develop .json {
		font-size: 0.8em;
	}

	.action-menu button {
		border: none;
		background-color: inherit;
	}
</style>
