<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { appName } from '$lib/Constants';
	import Notification from './Notification.svelte';
	import ReactionEmoji from './ReactionEmoji.svelte';
	import Logout from '../Logout.svelte';
	import { author } from '../../../stores/Author';
	import { debugMode } from '../../../stores/Preference';
	import WordMute from './WordMute.svelte';
	import AutoRefresh from './AutoRefresh.svelte';
	import MutedUsers from './MutedUsers.svelte';
	import MutedEvents from './MutedEvents.svelte';
	import ClearEmojiMartCache from './ClearEmojiMartCache.svelte';
	import Theme from './Theme.svelte';
	import ZapButton from '$lib/components/ZapButton.svelte';
	import UriScheme from './UriScheme.svelte';

	let debugCounter = 0;

	function enableDebugMode() {
		debugCounter++;
		if (debugCounter >= 5) {
			$debugMode = !$debugMode;
			debugCounter = 0;
			console.log('[debug mode]', $debugMode ? 'enabled' : 'disabled');
		}
	}
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.preferences')}</title>
</svelte:head>

<h1>{$_('layout.header.preferences')}</h1>

<div><Theme /></div>
{#if $author !== undefined}
	<div><ReactionEmoji /></div>
	<div>
		<a href="https://emojis-iota.vercel.app/" target="_blank" rel="noopener noreferrer">
			Edit custom emojis
		</a>
	</div>
	<div><MutedUsers /></div>
	<div><MutedEvents /></div>
	<div><WordMute /></div>
{/if}
<div><Notification /></div>
<div><UriScheme /></div>
<div><AutoRefresh /></div>
{#if $debugMode}
	<div><ClearEmojiMartCache /></div>
{/if}
<div><Logout /></div>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<h1 on:click={enableDebugMode}>About nostter</h1>
<div>
	<span>GitHub:</span>
	<a href="https://github.com/SnowCait/nostter" target="_blank" rel="noopener noreferrer">
		SnowCait/nostter
	</a>
</div>
<div class="user">
	<span>Author:</span>
	<a href="/npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw">@SnowCait</a>
	<ZapButton pubkey="83d52b4363d2d1bc5a098de7be67c120bfb7c0cee8efefd8eb6e42372af24689" />
</div>
<div class="user">
	<span>UI:</span>
	<a href="/npub194qhhn5vzzyrsqaugfms8c7ycqjyvhyguurra450nhlweatfzxkqy8tgkd">@kaiji</a>
	<ZapButton pubkey="2d417bce8c10883803bc427703e3c4c024465c88e7063ed68f9dfeecf56911ac" />
</div>
<div class="user">
	<span>Illustration:</span>
	<a href="/npub1e09suzmq9mp6nt0ud9ttl03790qjx70wzwlc2pwwghcusvwju54qs0c800">@stok33</a>
	<ZapButton pubkey="cbcb0e0b602ec3a9adfc6956bfbe3e2bc12379ee13bf8505ce45f1c831d2e52a" />
</div>
<img
	src="/nostter-chan.jpg"
	alt=""
	title="前から知っていたような雰囲気ですぐ馴染めるタイプの娘。パーカーの中には json が格納されていて聞くと教えてくれるよ。あとかなり物覚えが良いので昔のことも覚えててくれるよ。"
/>

<style>
	div {
		margin: 1em auto;
	}

	img {
		width: 50%;
		border: 1px solid lightgray;
		border-radius: 10px;
	}

	.user {
		display: flex;
		align-items: center;
	}

	.user * {
		margin-right: 0.2rem;
	}
</style>
