<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { appName } from '$lib/Constants';
	import { decryptListContent } from '$lib/List';
	import Notification from './Notification.svelte';
	import ReactionEmoji from './ReactionEmoji.svelte';
	import Logout from '../Logout.svelte';
	import { author, muteEvent, pubkey, rom } from '$lib/stores/Author';
	import { developerMode } from '$lib/stores/Preference';
	import AutoRefresh from './AutoRefresh.svelte';
	import MutedUsers from './MutedUsers.svelte';
	import MutedEvents from './MutedEvents.svelte';
	import MutedWords from './MutedWords.svelte';
	import ClearEmojiMartCache from './ClearEmojiMartCache.svelte';
	import Theme from './Theme.svelte';
	import UriScheme from './UriScheme.svelte';
	import EnablePreview from './EnablePreview.svelte';
	import DeveloperMode from './DeveloperMode.svelte';
	import WebStorage from './WebStorage.svelte';
	import RelayStates from './RelayStates.svelte';
	import WalletConnect from './WalletConnect.svelte';
	import Reload from './Reload.svelte';
	import ClearEventCacheAndReload from './ClearEventCacheAndReload.svelte';
	import MediaUploader from './MediaUploader.svelte';
	import ImageOptimization from './ImageOptimization.svelte';
	import TimelineFilter from './TimelineFilter.svelte';
	import MuteAutomatically from './MuteAutomatically.svelte';
	import Json from '$lib/components/Json.svelte';
	import Language from './Language.svelte';
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.preferences')}</title>
</svelte:head>

<h1>{$_('layout.header.preferences')}</h1>

{#if $author !== undefined && !$rom}
	<section class="card">
		<h2>{$_('preferences.shared')}</h2>
		<div>
			<a href="/profile">{$_('pages.profile_edit')}</a>
		</div>
		<div><ReactionEmoji /></div>
		<div>
			<a href="https://emojito.meme/" target="_blank" rel="noopener noreferrer">
				{$_('preferences.emoji.custom')}
			</a>
		</div>
		<div><MediaUploader /></div>
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
			<MutedWords />
		</details>
		{#if $developerMode}
			<details>
				<summary>JSON</summary>
				<div>public</div>
				<Json object={$muteEvent?.tags ?? []} />
				<div>private</div>
				{#await decryptListContent($muteEvent?.content ?? '')}
					<Json object={[]} />
				{:then tags}
					<Json object={tags} />
				{/await}
			</details>
		{/if}
		<div><MuteAutomatically /></div>
		<div>
			<a href="/{nip19.nprofileEncode({ pubkey: $pubkey })}/relays">
				{$_('pages.relays_edit')}
			</a>
		</div>
	</section>
{/if}

<section class="card">
	<h2>{$_('preferences.device')}</h2>
	<div><Theme /></div>
	<div><Language /></div>
	<div><AutoRefresh /></div>
	<div><EnablePreview /></div>
	<div><ImageOptimization /></div>
	<div><Notification /></div>
	<div><UriScheme /></div>
	<h3>{$_('preferences.timeline_filter.title')}</h3>
	<div><TimelineFilter /></div>
	<div><WalletConnect /></div>
	<div><DeveloperMode /></div>
	{#if $developerMode}
		<div><RelayStates /></div>
		<div><WebStorage /></div>
		<h3>{$_('preferences.trouble_shooting')}</h3>
		<div><Reload /></div>
		<div><ClearEventCacheAndReload /></div>
		<div><ClearEmojiMartCache /></div>
	{/if}
</section>

<section class="card">
	<h2>{$_('logout.logout')}</h2>
	<div><Logout /></div>
</section>

<style>
	div {
		margin: 1em auto;
	}
</style>
