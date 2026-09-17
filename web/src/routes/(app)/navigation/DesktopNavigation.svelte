<script lang="ts">
	import {
		IconBell,
		IconBellFilled,
		IconBookmark,
		IconBookmarkFilled,
		IconHome,
		IconHomeFilled,
		IconList,
		IconListFilled,
		IconMessages,
		IconMessagesFilled,
		IconPaw,
		IconPawFilled,
		IconSearch,
		IconSearchFilled,
		IconSettings,
		IconSettingsFilled,
		IconUser,
		IconUserFilled,
		IconWorld,
		IconWorldFilled
	} from '@tabler/icons-svelte-runes';
	import { _ } from 'svelte-i18n';
	import type { AppNavigationItem } from './app-navigation';

	interface Props {
		pubkey: string | undefined;
		homeLink: string;
		nprofile: string;
		notificationsBadge: boolean;
		currentNavigation: AppNavigationItem | undefined;
		onClickHomeLink: (event: MouseEvent) => void;
		onClickPublicLink: (event: MouseEvent) => void;
	}

	let {
		pubkey,
		homeLink,
		nprofile,
		notificationsBadge,
		currentNavigation,
		onClickHomeLink,
		onClickPublicLink
	}: Props = $props();

	let HomeIcon = $derived(currentNavigation === 'home' ? IconHomeFilled : IconHome);
	let PublicIcon = $derived(currentNavigation === 'public' ? IconWorldFilled : IconWorld);
	let SearchIcon = $derived(currentNavigation === 'search' ? IconSearchFilled : IconSearch);
	let NotificationsIcon = $derived(
		currentNavigation === 'notifications' ? IconBellFilled : IconBell
	);
	let ListsIcon = $derived(currentNavigation === 'lists' ? IconListFilled : IconList);
	let BookmarksIcon = $derived(
		currentNavigation === 'bookmarks' ? IconBookmarkFilled : IconBookmark
	);
	let ChannelsIcon = $derived(
		currentNavigation === 'channels' ? IconMessagesFilled : IconMessages
	);
	let ProfileIcon = $derived(currentNavigation === 'profile' ? IconUserFilled : IconUser);
	let PreferencesIcon = $derived(
		currentNavigation === 'preferences' ? IconSettingsFilled : IconSettings
	);
	let AboutIcon = $derived(currentNavigation === 'about' ? IconPawFilled : IconPaw);
</script>

<ul class="full">
	<li class="clickable">
		<a
			href={homeLink}
			onclick={onClickHomeLink}
			aria-current={currentNavigation === 'home' ? 'page' : undefined}
		>
			<HomeIcon size={30} />
			<p>{$_('layout.header.home')}</p>
		</a>
	</li>
	<li class="clickable">
		<a
			href="/public"
			onclick={onClickPublicLink}
			aria-current={currentNavigation === 'public' ? 'page' : undefined}
		>
			<PublicIcon size={30} />
			<p>{$_('pages.public')}</p>
		</a>
	</li>
	<li class="clickable">
		<a href="/search" aria-current={currentNavigation === 'search' ? 'page' : undefined}>
			<SearchIcon size={30} />
			<p>{$_('layout.header.search')}</p>
		</a>
	</li>
	{#if pubkey}
		<li class="clickable notifications-icon">
			<a
				href="/notifications"
				aria-current={currentNavigation === 'notifications' ? 'page' : undefined}
			>
				<NotificationsIcon size={30} />
				{#if notificationsBadge}
					<span class="notifications-icon-badge"></span>
				{/if}
				<p>{$_('layout.header.notifications')}</p>
			</a>
		</li>
		<li class="clickable">
			<a
				href="/{nprofile}/lists"
				aria-current={currentNavigation === 'lists' ? 'page' : undefined}
			>
				<ListsIcon size={30} />
				<p>{$_('lists.title')}</p>
			</a>
		</li>
		<li class="clickable">
			<a
				href="/{nprofile}/bookmarks"
				aria-current={currentNavigation === 'bookmarks' ? 'page' : undefined}
			>
				<BookmarksIcon size={30} />
				<p>{$_('layout.header.bookmarks')}</p>
			</a>
		</li>
	{/if}
	<li class="clickable">
		<a href="/channels" aria-current={currentNavigation === 'channels' ? 'page' : undefined}>
			<ChannelsIcon size={30} />
			<p>{$_('layout.header.channels')}</p>
		</a>
	</li>
	{#if pubkey}
		<li class="clickable">
			<a
				href="/{nprofile}"
				aria-current={currentNavigation === 'profile' ? 'page' : undefined}
			>
				<ProfileIcon size={30} />
				<p>{$_('layout.header.profile')}</p>
			</a>
		</li>
		<li class="clickable">
			<a
				href="/preferences"
				aria-current={currentNavigation === 'preferences' ? 'page' : undefined}
			>
				<PreferencesIcon size={30} />
				<p>{$_('layout.header.preferences')}</p>
			</a>
		</li>
	{/if}
	<li class="clickable">
		<a href="/about" aria-current={currentNavigation === 'about' ? 'page' : undefined}>
			<AboutIcon size={30} />
			<p>{$_('about.title')}</p>
		</a>
	</li>
</ul>

<style>
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

	li a {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.5rem 1rem;
		text-decoration: none;
		color: var(--accent);
	}

	li a:visited {
		color: var(--accent);
	}

	li p {
		margin-left: 0.5rem;
		font-size: 1.15rem;
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

	@media screen and (max-width: 926px) {
		li a {
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
		ul.full {
			display: none;
		}
	}
</style>
