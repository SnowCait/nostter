<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip19, type Event } from 'nostr-tools';
	import { appName } from '$lib/app';
	import { emojiEditorUrl } from '$lib/Constants';
	import { createListContentDecrypter } from '$lib/List';
	import Notification from './Notification.svelte';
	import ReactionEmoji from './ReactionEmoji.svelte';
	import Logout from '../Logout.svelte';
	import { auth } from '$lib/auth.svelte';
	import type { Signer } from '$lib/nostr/signing/signer';
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
	import GifAutoplay from './GifAutoplay.svelte';
	import UserStatus from './UserStatus.svelte';
	import DeveloperMode from './DeveloperMode.svelte';
	import WebStorage from './WebStorage.svelte';
	import RelayStates from './RelayStates.svelte';
	import SeenOnRelayIcon from './SeenOnRelayIcon.svelte';
	import ShowVia from './ShowVia.svelte';
	import WalletConnect from './WalletConnect.svelte';
	import Reload from './Reload.svelte';
	import ClearEventCacheAndReload from './ClearEventCacheAndReload.svelte';
	import MediaUploader from './MediaUploader.svelte';
	import ImageOptimization from './ImageOptimization.svelte';
	import Json from '$lib/components/Json.svelte';
	import Language from './Language.svelte';
	import Backup from './Backup.svelte';
	import WorkAsRemoteSigner from './WorkAsRemoteSigner.svelte';
	import NotificationVisibility from './NotificationVisibility.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';

	async function signEvent(template: Parameters<Signer['signEvent']>[0]) {
		const signer = auth.signer;
		if (signer === undefined) {
			throw new Error('Cannot sign an event without a signing session');
		}

		return signer.signEvent(template);
	}

	async function decryptMuteEvent(event: Event | undefined): Promise<string[][]> {
		if (event === undefined || event.content === '') {
			return [];
		}

		const signer = auth.signer;
		if (signer === undefined) {
			return [];
		}

		const decryptPrivateListContent = createListContentDecrypter(signer);
		if (decryptPrivateListContent === undefined) {
			return [];
		}

		const [tags] = await decryptPrivateListContent(event.pubkey, event.content);
		return tags;
	}
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.preferences')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1>{$_('layout.header.preferences')}</h1>

{#if auth.isAuthenticated && $author !== undefined && !$rom}
	<section class="card">
		<h2>{$_('preferences.shared')}</h2>
		<div>
			<a href="/profile">{$_('pages.profile_edit')}</a>
		</div>
		<div><ReactionEmoji {signEvent} /></div>
		<div>
			<ExternalLink link={new URL(emojiEditorUrl)}>
				{$_('preferences.emoji.custom')}
			</ExternalLink>
		</div>
		<div><MediaUploader /></div>
		<h3>{$_('preferences.mute.mute')}</h3>
		<details>
			<summary>{$_('preferences.mute.pubkeys')}</summary>
			<MutedUsers {signEvent} />
		</details>
		<details>
			<summary>{$_('preferences.mute.events')}</summary>
			<MutedEvents {signEvent} />
		</details>
		<details>
			<summary>{$_('preferences.mute.words')}</summary>
			<MutedWords {signEvent} />
		</details>
		{#if $developerMode}
			<details>
				<summary>JSON</summary>
				<div>public</div>
				<Json object={$muteEvent?.tags ?? []} />
				<div>private</div>
				{#await decryptMuteEvent($muteEvent)}
					<Json object={[]} />
				{:then tags}
					<Json object={tags} />
				{/await}
			</details>
		{/if}
		{#if $pubkey !== undefined}
			<div>
				<a href="/{nip19.nprofileEncode({ pubkey: $pubkey })}/relays">
					{$_('pages.relays_edit')}
				</a>
			</div>
		{/if}
	</section>
{/if}

<section class="card">
	<h2>{$_('preferences.device')}</h2>
	<div><Theme /></div>
	<div><Language /></div>
	<div><AutoRefresh /></div>
	<div><EnablePreview /></div>
	<div><GifAutoplay /></div>
	<div><UserStatus /></div>
	<div><NotificationVisibility /></div>
	<div><ImageOptimization /></div>
	<div><Notification /></div>
	<div><UriScheme /></div>
	<div><WalletConnect /></div>
	<div><Backup {signEvent} /></div>
	<div><DeveloperMode /></div>
	{#if $developerMode}
		<div><SeenOnRelayIcon /></div>
		<div><ShowVia /></div>

		{#if auth.isAuthenticated && !$rom}
			<div><WorkAsRemoteSigner /></div>
		{/if}

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
