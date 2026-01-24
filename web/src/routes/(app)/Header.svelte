<script lang="ts">
	import IconHome from '@tabler/icons-svelte/icons/home';
	import IconWorld from '@tabler/icons-svelte/icons/world';
	import IconSearch from '@tabler/icons-svelte/icons/search';
	import IconBell from '@tabler/icons-svelte/icons/bell';
	import IconUser from '@tabler/icons-svelte/icons/user';
	import IconSettings from '@tabler/icons-svelte/icons/settings';
	import IconList from '@tabler/icons-svelte/icons/list';
	import IconBookmark from '@tabler/icons-svelte/icons/bookmark';
	import IconMessages from '@tabler/icons-svelte/icons/messages';
	import IconPencilPlus from '@tabler/icons-svelte/icons/pencil-plus';
	import IconLogin from '@tabler/icons-svelte/icons/login';
	import IconDots from '@tabler/icons-svelte/icons/dots';
	import IconPaw from '@tabler/icons-svelte/icons/paw';
	import { nip19 } from 'nostr-tools';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { preferencesStore } from '$lib/Preferences';
	import { followeesOfFollowees } from '$lib/author/MuteAutomatically';
	import { followees, pubkey, rom } from '$lib/stores/Author';
	import { openNoteDialog } from '$lib/stores/NoteDialog';
	import { lastReadAt, notifiedEventItems } from '$lib/author/Notifications';
	import NostterLogo from '$lib/components/logo/NostterLogo.svelte';
	import NostterLogoIcon from '$lib/components/logo/NostterLogoIcon.svelte';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';

	const {
		elements: { menu, item, trigger, overlay }
	} = createDropdownMenu({ preventScroll: false });

	async function onClickPostButton(): Promise<void> {
		$openNoteDialog = !$openNoteDialog;
	}

	let homeLink = $derived(
		$followees.filter((x) => x !== $pubkey).length > 0 ? '/home' : '/public'
	);
	let nprofile = $derived(nip19.nprofileEncode({ pubkey: $pubkey }));
	let notificationsBadge = $derived(
		$notifiedEventItems.filter(
			(item) =>
				item.event.created_at > $lastReadAt &&
				(!$preferencesStore.muteAutomatically ||
					$followeesOfFollowees.has(item.event.pubkey))
		).length > 0
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
		<ul class="full">
			<li class="clickable">
				<a href={homeLink}>
					<IconHome size={30} />
					<p>{$_('layout.header.home')}</p>
				</a>
			</li>
			<li class="clickable">
				<a href="/public">
					<IconWorld size={30} />
					<p>{$_('pages.public')}</p>
				</a>
			</li>
			<li class="clickable">
				<a href="/search">
					<IconSearch size={30} />
					<p>{$_('layout.header.search')}</p>
				</a>
			</li>
			{#if $pubkey}
				<li class="clickable notifications-icon">
					<a href="/notifications">
						<IconBell size={30} />
						{#if notificationsBadge}
							<span class="notifications-icon-badge"></span>
						{/if}
						<p>{$_('layout.header.notifications')}</p>
					</a>
				</li>
			{/if}
			{#if $pubkey}
				<li class="clickable">
					<a href="/{nprofile}/lists">
						<IconList size={30} />
						<p>{$_('lists.title')}</p>
					</a>
				</li>
				<li class="clickable">
					<a href="/{nprofile}/bookmarks">
						<IconBookmark size={30} />
						<p>{$_('layout.header.bookmarks')}</p>
					</a>
				</li>
			{/if}
			<li class="clickable">
				<a href="/channels">
					<IconMessages size={30} />
					<p>{$_('layout.header.channels')}</p>
				</a>
			</li>
			{#if $pubkey}
				<li class="clickable">
					<a href="/{nprofile}">
						<IconUser size={30} />
						<p>{$_('layout.header.profile')}</p>
					</a>
				</li>
				<li class="clickable">
					<a href="/preferences">
						<IconSettings size={30} />
						<p>{$_('layout.header.preferences')}</p>
					</a>
				</li>
			{/if}
			<li class="clickable">
				<a href="/about">
					<IconPaw size={30} />
					<p>{$_('about.title')}</p>
				</a>
			</li>
		</ul>
		<ul class="fold">
			<li>
				<a href={homeLink}>
					<IconHome size={30} />
					<p>{$_('layout.header.home')}</p>
				</a>
			</li>
			{#if !$pubkey}
				<li>
					<a href="/public">
						<IconWorld size={30} />
						<p>{$_('pages.public')}</p>
					</a>
				</li>
			{/if}
			<li>
				<a href="/search">
					<IconSearch size={30} />
					<p>{$_('layout.header.search')}</p>
				</a>
			</li>
			{#if $pubkey}
				<li class="notifications-icon">
					<a href="/notifications">
						<IconBell size={30} />
						{#if notificationsBadge}
							<span class="notifications-icon-badge"></span>
						{/if}
						<p>{$_('layout.header.notifications')}</p>
					</a>
				</li>
				<li>
					<a href="/{nprofile}">
						<IconUser size={30} />
						<p>{$_('layout.header.profile')}</p>
					</a>
				</li>
				<li>
					<button class="clear" use:melt={$trigger}>
						<IconDots size={30} />
					</button>
					<div use:melt={$overlay} class="overlay"></div>
					<div use:melt={$menu} class="menu">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							use:melt={$item}
							onclick={async () => await goto(`/public`)}
							class="item"
						>
							<div class="icon"><IconWorld /></div>
							<div>{$_('pages.public')}</div>
						</div>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							use:melt={$item}
							onclick={async () => await goto(`/${nprofile}/lists`)}
							class="item"
						>
							<div class="icon"><IconList /></div>
							<div>{$_('lists.title')}</div>
						</div>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							use:melt={$item}
							onclick={async () => await goto(`/${nprofile}/bookmarks`)}
							class="item"
						>
							<div class="icon"><IconBookmark /></div>
							<div>{$_('layout.header.bookmarks')}</div>
						</div>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							use:melt={$item}
							onclick={async () => await goto('/channels')}
							class="item"
						>
							<div class="icon"><IconMessages /></div>
							<div>{$_('layout.header.channels')}</div>
						</div>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							use:melt={$item}
							onclick={async () => await goto('/preferences')}
							class="item"
						>
							<div class="icon"><IconSettings /></div>
							<div>{$_('layout.header.preferences')}</div>
						</div>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							use:melt={$item}
							onclick={async () => await goto('/about')}
							class="item"
						>
							<div class="icon"><IconPaw /></div>
							<div>{$_('about.title')}</div>
						</div>
					</div>
				</li>
			{:else}
				<li>
					<a href="/channels">
						<IconMessages size={30} />
						<p>{$_('layout.header.channels')}</p>
					</a>
				</li>
				<li>
					<a href="/about">
						<IconPaw size={30} />
						<p>{$_('about.title')}</p>
					</a>
				</li>
			{/if}
		</ul>
	</nav>
	{#if $pubkey && !$rom}
		<button title="{$_('post')} (N)" onclick={onClickPostButton}>
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

	ul {
		list-style: none;
		padding: 0;
		flex-flow: column;
		justify-content: left;
		gap: 0.5rem;
	}

	ul.full {
		display: flex;
	}

	ul.fold {
		display: none;
	}

	li a {
		display: flex;
		align-items: center;
		width: 100%;
	}

	ul.full li a {
		padding: 0.5rem 1rem;
	}

	li p {
		margin-left: 0.5rem;
		font-size: 1.15rem;
	}

	ul.fold li button {
		color: var(--accent);
	}

	.menu {
		z-index: 3;
	}

	.notifications-icon {
		position: relative;
	}

	.notifications-icon .notifications-icon-badge {
		position: absolute;
		top: 0.55rem;
		left: 2rem;
		width: 0.72rem;
		height: 0.72rem;
		border-radius: 9999px;
		background-color: var(--red);
		border: 0.18rem solid var(--accent);
	}

	@media screen and (max-width: 928px) {
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

		ul.full li a {
			padding: 0.5rem;
		}

		li p {
			display: none;
			margin-left: 0.5rem;
			font-size: 1.15rem;
		}

		.notifications-icon .notifications-icon-badge {
			top: 0.55rem;
			left: 1.5rem;
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

		nav {
			margin: 0;
			width: 100%;
		}

		ul {
			flex-flow: row;
			justify-content: space-around;
			margin: 0;
			align-items: center;
		}

		ul.full {
			display: none;
		}

		ul.fold {
			display: flex;
		}

		ul.fold li a:active {
			transform: scale(0.9);
			opacity: 0.7;
		}

		li p {
			display: none;
		}

		.notifications-icon .notifications-icon-badge {
			top: 0.05rem;
			left: 1rem;
		}
	}
</style>
