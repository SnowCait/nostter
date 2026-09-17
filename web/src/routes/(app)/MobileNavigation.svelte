<script lang="ts">
	import {
		IconBell,
		IconBellFilled,
		IconBookmark,
		IconBookmarkFilled,
		IconDots,
		IconDotsFilled,
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
	import { goto } from '$app/navigation';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import { isMoreNavigationCurrent, type HeaderNavigationItem } from './HeaderNavigation';

	interface Props {
		pubkey: string | undefined;
		homeLink: string;
		nprofile: string;
		notificationsBadge: boolean;
		currentNavigation: HeaderNavigationItem | undefined;
		onClickHomeLink: (event: MouseEvent) => void;
		onClickPublicLink: (event: MouseEvent) => void;
		onClickPublicMenuItem: (event: MouseEvent) => Promise<void>;
	}

	let {
		pubkey,
		homeLink,
		nprofile,
		notificationsBadge,
		currentNavigation,
		onClickHomeLink,
		onClickPublicLink,
		onClickPublicMenuItem
	}: Props = $props();

	const {
		elements: { menu, item, trigger, overlay }
	} = createDropdownMenu({ preventScroll: false });

	let moreNavigationCurrent = $derived(isMoreNavigationCurrent(currentNavigation));
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
	let MoreIcon = $derived(moreNavigationCurrent ? IconDotsFilled : IconDots);
</script>

<ul class="fold">
	<li>
		<a
			href={homeLink}
			class="active"
			onclick={onClickHomeLink}
			aria-current={currentNavigation === 'home' ? 'page' : undefined}
		>
			<HomeIcon size={30} />
			<p>{$_('layout.header.home')}</p>
		</a>
	</li>
	{#if !pubkey}
		<li>
			<a
				href="/public"
				class="active"
				onclick={onClickPublicLink}
				aria-current={currentNavigation === 'public' ? 'page' : undefined}
			>
				<PublicIcon size={30} />
				<p>{$_('pages.public')}</p>
			</a>
		</li>
	{/if}
	<li>
		<a
			href="/search"
			class="active"
			aria-current={currentNavigation === 'search' ? 'page' : undefined}
		>
			<SearchIcon size={30} />
			<p>{$_('layout.header.search')}</p>
		</a>
	</li>
	{#if pubkey}
		<li class="notifications-icon">
			<a
				href="/notifications"
				class="active"
				aria-current={currentNavigation === 'notifications' ? 'page' : undefined}
			>
				<NotificationsIcon size={30} />
				{#if notificationsBadge}
					<span class="notifications-icon-badge"></span>
				{/if}
				<p>{$_('layout.header.notifications')}</p>
			</a>
		</li>
		<li>
			<a
				href="/{nprofile}"
				class="active"
				aria-current={currentNavigation === 'profile' ? 'page' : undefined}
			>
				<ProfileIcon size={30} />
				<p>{$_('layout.header.profile')}</p>
			</a>
		</li>
		<li>
			<button class="clear active" use:melt={$trigger}>
				<MoreIcon size={30} />
			</button>
			<div use:melt={$overlay} class="overlay"></div>
			<div use:melt={$menu} class="menu">
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={onClickPublicMenuItem} class="item">
					<div class="icon"><PublicIcon /></div>
					<div>{$_('pages.public')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					use:melt={$item}
					onclick={async () => await goto(`/${nprofile}/lists`)}
					class="item"
				>
					<div class="icon"><ListsIcon /></div>
					<div>{$_('lists.title')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					use:melt={$item}
					onclick={async () => await goto(`/${nprofile}/bookmarks`)}
					class="item"
				>
					<div class="icon"><BookmarksIcon /></div>
					<div>{$_('layout.header.bookmarks')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={async () => await goto('/channels')} class="item">
					<div class="icon"><ChannelsIcon /></div>
					<div>{$_('layout.header.channels')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={async () => await goto('/preferences')} class="item">
					<div class="icon"><PreferencesIcon /></div>
					<div>{$_('layout.header.preferences')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={async () => await goto('/about')} class="item">
					<div class="icon"><AboutIcon /></div>
					<div>{$_('about.title')}</div>
				</div>
			</div>
		</li>
	{:else}
		<li>
			<a
				href="/channels"
				class="active"
				aria-current={currentNavigation === 'channels' ? 'page' : undefined}
			>
				<ChannelsIcon size={30} />
				<p>{$_('layout.header.channels')}</p>
			</a>
		</li>
		<li>
			<a
				href="/about"
				class="active"
				aria-current={currentNavigation === 'about' ? 'page' : undefined}
			>
				<AboutIcon size={30} />
				<p>{$_('about.title')}</p>
			</a>
		</li>
	{/if}
</ul>

<style>
	a {
		text-decoration: none;
		color: var(--accent);
	}

	a:visited {
		color: var(--accent);
	}

	ul {
		list-style: none;
		padding: 0;
		flex-flow: column;
		justify-content: left;
		gap: 0.5rem;
	}

	ul.fold {
		display: none;
	}

	li a {
		display: flex;
		align-items: center;
		width: 100%;
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

	@media screen and (max-width: 926px) {
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
		ul {
			flex-flow: row;
			justify-content: space-around;
			margin: 0;
			align-items: center;
		}

		ul.fold {
			display: flex;
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
