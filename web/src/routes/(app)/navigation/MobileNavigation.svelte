<script lang="ts">
	import { IconDots, IconDotsFilled } from '@tabler/icons-svelte-runes';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import { isMoreNavigationCurrent, type AppNavigationItem } from './app-navigation';
	import NavigationIcon from './NavigationIcon.svelte';

	interface Props {
		pubkey: string | undefined;
		homeLink: string;
		nprofile: string | undefined;
		notificationsBadge: boolean;
		currentNavigation: AppNavigationItem | undefined;
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
			<NavigationIcon item="home" {currentNavigation} size={30} />
			<p>{$_('layout.header.home')}</p>
		</a>
	</li>
	{#if pubkey === undefined}
		<li>
			<a
				href="/public"
				class="active"
				onclick={onClickPublicLink}
				aria-current={currentNavigation === 'public' ? 'page' : undefined}
			>
				<NavigationIcon item="public" {currentNavigation} size={30} />
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
			<NavigationIcon item="search" {currentNavigation} size={30} />
			<p>{$_('layout.header.search')}</p>
		</a>
	</li>
	{#if pubkey !== undefined}
		<li class="notifications-icon">
			<a
				href="/notifications"
				class="active"
				aria-current={currentNavigation === 'notifications' ? 'page' : undefined}
			>
				<NavigationIcon item="notifications" {currentNavigation} size={30} />
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
				<NavigationIcon item="profile" {currentNavigation} size={30} />
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
					<div class="icon"><NavigationIcon item="public" {currentNavigation} /></div>
					<div>{$_('pages.public')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					use:melt={$item}
					onclick={async () => await goto(`/${nprofile}/lists`)}
					class="item"
				>
					<div class="icon"><NavigationIcon item="lists" {currentNavigation} /></div>
					<div>{$_('lists.title')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					use:melt={$item}
					onclick={async () => await goto(`/${nprofile}/bookmarks`)}
					class="item"
				>
					<div class="icon"><NavigationIcon item="bookmarks" {currentNavigation} /></div>
					<div>{$_('layout.header.bookmarks')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={async () => await goto('/channels')} class="item">
					<div class="icon"><NavigationIcon item="channels" {currentNavigation} /></div>
					<div>{$_('layout.header.channels')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={async () => await goto('/preferences')} class="item">
					<div class="icon">
						<NavigationIcon item="preferences" {currentNavigation} />
					</div>
					<div>{$_('layout.header.preferences')}</div>
				</div>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={async () => await goto('/about')} class="item">
					<div class="icon"><NavigationIcon item="about" {currentNavigation} /></div>
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
				<NavigationIcon item="channels" {currentNavigation} size={30} />
				<p>{$_('layout.header.channels')}</p>
			</a>
		</li>
		<li>
			<a
				href="/about"
				class="active"
				aria-current={currentNavigation === 'about' ? 'page' : undefined}
			>
				<NavigationIcon item="about" {currentNavigation} size={30} />
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
