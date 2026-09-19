<script lang="ts">
	import { _ } from 'svelte-i18n';
	import NavigationIcon from './NavigationIcon.svelte';
	import type { AppNavigationItem } from './app-navigation';

	interface Props {
		pubkey: string | undefined;
		homeLink: string;
		nprofile: string | undefined;
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
</script>

<ul class="full">
	<li class="clickable">
		<a
			href={homeLink}
			onclick={onClickHomeLink}
			aria-current={currentNavigation === 'home' ? 'page' : undefined}
		>
			<NavigationIcon item="home" {currentNavigation} size={30} />
			<p>{$_('layout.header.home')}</p>
		</a>
	</li>
	<li class="clickable">
		<a
			href="/public"
			onclick={onClickPublicLink}
			aria-current={currentNavigation === 'public' ? 'page' : undefined}
		>
			<NavigationIcon item="public" {currentNavigation} size={30} />
			<p>{$_('pages.public')}</p>
		</a>
	</li>
	<li class="clickable">
		<a href="/search" aria-current={currentNavigation === 'search' ? 'page' : undefined}>
			<NavigationIcon item="search" {currentNavigation} size={30} />
			<p>{$_('layout.header.search')}</p>
		</a>
	</li>
	{#if pubkey}
		<li class="clickable notifications-icon">
			<a
				href="/notifications"
				aria-current={currentNavigation === 'notifications' ? 'page' : undefined}
			>
				<NavigationIcon item="notifications" {currentNavigation} size={30} />
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
				<NavigationIcon item="lists" {currentNavigation} size={30} />
				<p>{$_('lists.title')}</p>
			</a>
		</li>
		<li class="clickable">
			<a
				href="/{nprofile}/bookmarks"
				aria-current={currentNavigation === 'bookmarks' ? 'page' : undefined}
			>
				<NavigationIcon item="bookmarks" {currentNavigation} size={30} />
				<p>{$_('layout.header.bookmarks')}</p>
			</a>
		</li>
	{/if}
	<li class="clickable">
		<a href="/channels" aria-current={currentNavigation === 'channels' ? 'page' : undefined}>
			<NavigationIcon item="channels" {currentNavigation} size={30} />
			<p>{$_('layout.header.channels')}</p>
		</a>
	</li>
	{#if pubkey}
		<li class="clickable">
			<a
				href="/{nprofile}"
				aria-current={currentNavigation === 'profile' ? 'page' : undefined}
			>
				<NavigationIcon item="profile" {currentNavigation} size={30} />
				<p>{$_('layout.header.profile')}</p>
			</a>
		</li>
		<li class="clickable">
			<a
				href="/preferences"
				aria-current={currentNavigation === 'preferences' ? 'page' : undefined}
			>
				<NavigationIcon item="preferences" {currentNavigation} size={30} />
				<p>{$_('layout.header.preferences')}</p>
			</a>
		</li>
	{/if}
	<li class="clickable">
		<a href="/about" aria-current={currentNavigation === 'about' ? 'page' : undefined}>
			<NavigationIcon item="about" {currentNavigation} size={30} />
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
