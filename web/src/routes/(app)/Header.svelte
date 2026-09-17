<script lang="ts">
	import { IconLogin, IconPencilPlus } from '@tabler/icons-svelte-runes';
	import { nip19 } from 'nostr-tools';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { followees, pubkey, rom } from '$lib/stores/Author';
	import { getOpenNoteDialog } from '$lib/NoteDialogContext';
	import { lastReadAt, notifiedEventItems } from '$lib/author/Notifications';
	import NostterLogo from '$lib/components/logo/NostterLogo.svelte';
	import NostterLogoIcon from '$lib/components/logo/NostterLogoIcon.svelte';
	import { isVisibleNotification } from '$lib/preferences/NotificationVisibility.svelte';
	import { MouseButton } from '$lib/platform/browser/mouse-button';
	import { requestTimelineScrollToTop } from '$lib/timelines/ScrollToTop';
	import { composerFocus } from './channels/[nevent=note]/ComposerFocus.svelte';
	import DesktopNavigation from './navigation/DesktopNavigation.svelte';
	import { getCurrentAppNavigation } from './navigation/app-navigation';
	import MobileNavigation from './navigation/MobileNavigation.svelte';
	const openNoteDialog = getOpenNoteDialog();

	function onClickPostButton(): void {
		void openNoteDialog();
	}

	function requestTimelineScrollToTopForCurrentLink(event: MouseEvent, link: string): boolean {
		if (
			event.button !== MouseButton.Left ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			page.url.pathname !== link
		) {
			return false;
		}

		event.preventDefault();
		requestTimelineScrollToTop(link);
		return true;
	}

	function onClickHomeLink(event: MouseEvent): void {
		requestTimelineScrollToTopForCurrentLink(event, homeLink);
	}

	function onClickPublicLink(event: MouseEvent): void {
		requestTimelineScrollToTopForCurrentLink(event, '/public');
	}

	async function onClickPublicMenuItem(event: MouseEvent): Promise<void> {
		if (requestTimelineScrollToTopForCurrentLink(event, '/public')) {
			return;
		}

		await goto('/public');
	}

	let homeLink = $derived(
		$followees.filter((x) => x !== $pubkey).length > 0 ? '/home' : '/public'
	);
	let nprofile = $derived(nip19.nprofileEncode({ pubkey: $pubkey }));
	let notificationsBadge = $derived(
		$notifiedEventItems.filter(
			(item) =>
				item.event.created_at > $lastReadAt && isVisibleNotification(item.event.pubkey)
		).length > 0
	);
	let currentNavigation = $derived(
		getCurrentAppNavigation(page.route.id, page.data.pubkey, $pubkey)
	);
</script>

<div class="header">
	<div id="logo-icon-wrapper">
		<a href={$pubkey ? homeLink : '/'} id="logo-icon">
			<div class="logo-for-mobile">
				<NostterLogoIcon />
			</div>
			<div class="logo-for-desktop">
				<NostterLogo />
			</div>
		</a>
	</div>
	<nav>
		<DesktopNavigation
			pubkey={$pubkey}
			{homeLink}
			{nprofile}
			{notificationsBadge}
			{currentNavigation}
			{onClickHomeLink}
			{onClickPublicLink}
		/>
		<MobileNavigation
			pubkey={$pubkey}
			{homeLink}
			{nprofile}
			{notificationsBadge}
			{currentNavigation}
			{onClickHomeLink}
			{onClickPublicLink}
			{onClickPublicMenuItem}
		/>
	</nav>
	{#if $pubkey && !$rom}
		<button
			class:inline-composer-active={composerFocus.current !== undefined}
			title="{$_('post')} (N)"
			onclick={onClickPostButton}
		>
			<IconPencilPlus size={30} />
			<p>{$_('post')}</p>
		</button>
	{:else if !$pubkey}
		<button onclick={async () => await goto('/')}>
			<IconLogin size={30} />
			<p>{$_('login.login')}</p>
		</button>
	{/if}
</div>

<style>
	.header {
		/* min-width: 600px */
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.logo-for-mobile {
		display: none;
	}

	.logo-for-desktop {
		width: 127.5px;
		height: 32px;
		margin: 0 1rem;
	}

	nav {
		margin-top: 1rem;
		margin-bottom: 1.5rem;
	}

	a {
		text-decoration: none;
		color: var(--accent);
	}

	a:visited {
		color: var(--accent);
	}

	.header > button {
		width: calc(100% - 1rem);
		height: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-left: 1rem;

		position: sticky;
		bottom: 1.5rem;
	}

	@media screen and (max-width: 926px) {
		.header {
			display: flex;
			flex-direction: column;
			align-items: center;
		}

		#logo-icon-wrapper {
			width: 100%;
		}

		.logo-for-mobile {
			width: 30px;
			height: 30px;
			display: flex;
			justify-content: center;
			margin: auto;
		}

		.logo-for-desktop {
			display: none;
		}

		.header > button {
			padding: 0;
			padding-bottom: 4px;
			width: 3.125rem;
			height: 3.125rem;
			border-radius: 50%;
			margin: 0;
		}

		.header > button p {
			display: none;
		}
	}

	@media screen and (max-width: 600px) {
		.header {
			padding: 0;
			top: auto;
			bottom: 0;
			width: 100%;
			height: calc(3.125rem + env(safe-area-inset-bottom));
			background-color: var(--background);
			position: fixed;
			box-shadow: var(--shadow);
			justify-content: center;
			margin-top: 30px;
			padding-bottom: env(safe-area-inset-bottom);
		}

		#logo-icon-wrapper {
			position: fixed;
			top: 0;
			background-color: var(--background);
			box-shadow: var(--shadow);
			width: 100%;
			height: 3.125rem;
			padding: auto;
			display: flex;
			justify-content: center;
			align-items: center;
		}

		.header > button {
			position: fixed;
			bottom: calc(3.125rem + 0.75rem + env(safe-area-inset-bottom));
			right: 0.75rem;
		}

		.header > button.inline-composer-active {
			display: none;
		}

		nav {
			margin: 0;
			width: 100%;
		}
	}
</style>
