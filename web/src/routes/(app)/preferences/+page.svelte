<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { appName } from '$lib/Constants';
	import Notification from './Notification.svelte';
	import ReactionEmoji from './ReactionEmoji.svelte';
	import Logout from '../Logout.svelte';
	import { author } from '../../../stores/Author';
	import { debugMode, developerMode } from '../../../stores/Preference';
	import WordMute from './WordMute.svelte';
	import AutoRefresh from './AutoRefresh.svelte';
	import MutedUsers from './MutedUsers.svelte';
	import MutedEvents from './MutedEvents.svelte';
	import ClearEmojiMartCache from './ClearEmojiMartCache.svelte';
	import Theme from './Theme.svelte';
	import UriScheme from './UriScheme.svelte';
	import EnablePreview from './EnablePreview.svelte';
	import DeveloperMode from './DeveloperMode.svelte';
	import WebStorage from './WebStorage.svelte';
	import RelayStates from './RelayStates.svelte';
	import WalletConnect from './WalletConnect.svelte';
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.preferences')}</title>
</svelte:head>

<h1>{$_('layout.header.preferences')}</h1>

<h2>Device</h2>
<div><Theme /></div>
<div><EnablePreview /></div>
<div><Notification /></div>
<div><UriScheme /></div>
<div><AutoRefresh /></div>
<div><WalletConnect /></div>
<div><DeveloperMode /></div>
{#if $developerMode}
	<div><RelayStates /></div>
	<div><WebStorage /></div>
{/if}
{#if $debugMode}
	<div><ClearEmojiMartCache /></div>
{/if}
{#if $author !== undefined}
	<h2>Shared</h2>
	<div><ReactionEmoji /></div>
	<div>
		<a href="https://emojito.meme/" target="_blank" rel="noopener noreferrer">
			Edit custom emojis
		</a>
	</div>
	<h3>{$_('preferences.mute.mute')}</h3>
	<details>
		<summary>{$_('preferences.mute.pubkeys')}</summary>
		<MutedUsers />
	</details>
	<details>
		<summary>{$_('preferences.mute.events')}</summary>
		<MutedEvents />
	</details>
	<details>
		<summary>{$_('preferences.mute.words')}</summary>
		<WordMute />
	</details>
{/if}
<div><Logout /></div>

<style>
	div {
		margin: 1em auto;
	}
</style>
