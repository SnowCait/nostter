<script lang="ts">
	import { Menu } from '@svelteuidev/core';
	import IconHome from '@tabler/icons-svelte/icons/home';
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

	async function onClickPostButton(): Promise<void> {
		$openNoteDialog = !$openNoteDialog;
	}

	$: homeLink = $followees.filter((x) => x !== $pubkey).length > 0 ? '/home' : '/trend';
	$: nprofile = nip19.nprofileEncode({ pubkey: $pubkey });
	$: notificationsBadge =
		$notifiedEventItems.filter(
			(item) =>
				item.event.created_at > $lastReadAt &&
				(!$preferencesStore.muteAutomatically ||
					$followeesOfFollowees.has(item.event.pubkey))
		).length > 0;
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
			<a href={homeLink}>
				<li class="clickable">
					<IconHome size={30} />
					<p>{$_('layout.header.home')}</p>
				</li>
			</a>
			<a href="/search">
				<li class="clickable">
					<IconSearch size={30} />
					<p>{$_('layout.header.search')}</p>
				</li>
			</a>
			{#if $pubkey}
				<a href="/notifications">
					<li class="clickable notifications-icon">
						<IconBell size={30} />
						{#if notificationsBadge}
							<span class="notifications-icon-badge" />
						{/if}
						<p>{$_('layout.header.notifications')}</p>
					</li>
				</a>
			{/if}
			{#if $pubkey}
				<a href="/{nprofile}/lists">
					<li class="clickable">
						<IconList size={30} />
						<p>{$_('lists.title')}</p>
					</li>
				</a>
				<a href="/{nprofile}/bookmarks">
					<li class="clickable">
						<IconBookmark size={30} />
						<p>{$_('layout.header.bookmarks')}</p>
					</li>
				</a>
			{/if}
			<a href="/channels">
				<li class="clickable">
					<IconMessages size={30} />
					<p>{$_('layout.header.channels')}</p>
				</li>
			</a>
			{#if $pubkey}
				<a href="/{nprofile}">
					<li class="clickable">
						<IconUser size={30} />
						<p>{$_('layout.header.profile')}</p>
					</li>
				</a>
				<a href="/preferences">
					<li class="clickable">
						<IconSettings size={30} />
						<p>{$_('layout.header.preferences')}</p>
					</li>
				</a>
			{/if}
			<a href="/about">
				<li class="clickable">
					<IconPaw size={30} />
					<p>{$_('about.title')}</p>
				</li>
			</a>
		</ul>
		<ul class="fold">
			<a href={homeLink}>
				<li>
					<IconHome size={30} />
					<p>{$_('layout.header.home')}</p>
				</li>
			</a>
			<a href="/search">
				<li>
					<IconSearch size={30} />
					<p>{$_('layout.header.search')}</p>
				</li>
			</a>
			{#if $pubkey}
				<a href="/notifications">
					<li class="notifications-icon">
						<IconBell size={30} />
						{#if notificationsBadge}
							<span class="notifications-icon-badge" />
						{/if}
						<p>{$_('layout.header.notifications')}</p>
					</li>
				</a>
				<a href="/{nprofile}">
					<li>
						<IconUser size={30} />
						<p>{$_('layout.header.profile')}</p>
					</li>
				</a>
				<li>
					<Menu placement="center">
						<svelte:fragment slot="control">
							<IconDots size={30} />
						</svelte:fragment>

						<Menu.Item
							icon={IconList}
							on:click={async () => await goto(`/${nprofile}/lists`)}
						>
							{$_('lists.title')}
						</Menu.Item>
						<Menu.Item
							icon={IconBookmark}
							on:click={async () => await goto(`/${nprofile}/bookmarks`)}
						>
							{$_('layout.header.bookmarks')}
						</Menu.Item>
						<Menu.Item
							icon={IconMessages}
							on:click={async () => await goto('/channels')}
						>
							{$_('layout.header.channels')}
						</Menu.Item>
						<Menu.Item
							icon={IconSettings}
							on:click={async () => await goto('/preferences')}
						>
							{$_('layout.header.preferences')}
						</Menu.Item>
						<Menu.Item icon={IconPaw} on:click={async () => await goto('/about')}>
							{$_('about.title')}
						</Menu.Item>
					</Menu>
				</li>
			{:else}
				<a href="/channels">
					<li>
						<IconMessages size={30} />
						<p>{$_('layout.header.channels')}</p>
					</li>
				</a>
				<a href="/about">
					<li>
						<IconPaw size={30} />
						<p>{$_('about.title')}</p>
					</li>
				</a>
			{/if}
		</ul>
	</nav>
	{#if $pubkey && !$rom}
		<button title="{$_('post')} (N)" on:click={onClickPostButton}>
			<IconPencilPlus size={30} />
			<p>{$_('post')}</p>
		</button>
	{:else if !$pubkey}
		<button on:click={async () => await goto('/')}>
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
		align-self: flex-start;
		text-decoration: none;
	}

	button {
		width: calc(100% - 1rem);
		height: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-left: 1rem;
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

	li {
		display: flex;
		align-items: center;
		color: var(--accent);
		padding: 0.5rem 1rem;
	}

	li p {
		margin-left: 0.5rem;
		font-size: 1.15rem;
	}

	a:visited {
		color: inherit;
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

		button {
			padding: 0;
			padding-bottom: 4px;
			width: 3.125rem;
			height: 3.125rem;
			border-radius: 50%;
			margin: 0;
		}

		button p {
			display: none;
		}

		li {
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

		#logo-icon-wrapper > a {
			align-self: auto;
		}

		button {
			position: fixed;
			bottom: calc(3.125rem + 0.75rem + env(safe-area-inset-bottom));
			right: 0.75rem;
		}

		nav {
			margin: 0;
			width: 100%;
			overflow: auto;
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

		li p {
			display: none;
		}
	}
</style>
