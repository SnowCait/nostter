<script lang="ts">
	import { onMount } from 'svelte';
	import IconHome from '@tabler/icons-svelte/dist/svelte/icons/IconHome.svelte';
	import IconSearch from '@tabler/icons-svelte/dist/svelte/icons/IconSearch.svelte';
	import IconBell from '@tabler/icons-svelte/dist/svelte/icons/IconBell.svelte';
	import IconUser from '@tabler/icons-svelte/dist/svelte/icons/IconUser.svelte';
	import IconSettings from '@tabler/icons-svelte/dist/svelte/icons/IconSettings.svelte';
	import IconBookmark from '@tabler/icons-svelte/dist/svelte/icons/IconBookmark.svelte';
	import IconPencilPlus from '@tabler/icons-svelte/dist/svelte/icons/IconPencilPlus.svelte';
	import { nip19 } from 'nostr-tools';
	import { japaneseBotNpub, trendingPeopleBotNpub } from '$lib/Constants';
	import { unreadEvents } from '../../stores/Notifications';
	import { pubkey, rom } from '../../stores/Author';
	import { _ } from 'svelte-i18n';

	let npub = trendingPeopleBotNpub;

	onMount(() => {
		if (navigator.language.startsWith('ja')) {
			npub = japaneseBotNpub;
		}
	});

	export let onClickPostButton: () => void;
</script>

<div class="header">
	<div id="logo-icon-wrapper">
		<a href={$pubkey ? '/home' : '/'} id="logo-icon">
			<picture>
				<source
					srcset="/nostter-logo.svg"
					media="(min-width:928px)"
					width={120}
					height={24}
				/>
				<img src="/nostter-logo-icon.svg" alt="nostter logo" width={30} height={30} />
			</picture>
		</a>
	</div>
	<nav>
		<ul>
			<a href="/home">
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
						{#if $unreadEvents.length > 0}
							<span class="notifications-icon-badge" />
						{/if}
						<p>{$_('layout.header.notifications')}</p>
					</li>
				</a>
				<a href="/{nip19.npubEncode($pubkey)}/bookmark">
					<li>
						<IconBookmark size={30} />
						<p>{$_('layout.header.bookmark')}</p>
					</li>
				</a>
				<a href="/{nip19.npubEncode($pubkey)}">
					<li>
						<IconUser size={30} />
						<p>{$_('layout.header.profile')}</p>
					</li>
				</a>
				<a href="/preferences">
					<li>
						<IconSettings size={30} />
						<p>{$_('layout.header.preference')}</p>
					</li>
				</a>
			{/if}
		</ul>
	</nav>
	{#if $pubkey && !$rom}
		<button on:click={onClickPostButton}>
			<IconPencilPlus size={30} />
			<p>{$_('post')}</p>
		</button>
	{/if}
</div>

<style>
	.header {
		/* min-width: 600px */
		top: 2.25rem;
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	nav {
		margin-top: 1.5rem;
		margin-bottom: 2rem;
	}

	a {
		align-self: flex-start;
	}

	button {
		width: inherit;
		height: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-flow: column;
		justify-content: left;
		gap: 1.5rem;
	}

	li {
		display: flex;
		align-items: center;
		color: var(--accent);
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
		top: 0.05rem;
		left: 1rem;
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

		#logo-icon picture {
			width: 100%;
			display: flex;
			justify-content: center;
		}

		button {
			padding: 0;
			padding-bottom: 4px;
			width: 3.125rem;
			height: 3.125rem;
			border-radius: 50%;
		}

		button p {
			display: none;
		}

		li p {
			display: none;
			margin-left: 0.5rem;
			font-size: 1.15rem;
		}
	}

	@media screen and (max-width: 600px) {
		.header {
			padding: 0;
			top: auto;
			bottom: 0;
			width: 100%;
			height: 3.125rem;
			background-color: var(--background);
			position: fixed;
			box-shadow: var(--shadow);
			justify-content: center;
			margin-top: 30px;
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
			bottom: calc(3.125rem + 0.75rem);
			right: 0.75rem;
		}

		nav {
			margin: 0;
		}

		ul {
			flex-flow: row;
			justify-content: space-around;
			margin: 0;
			align-items: center;
		}

		li p {
			display: none;
		}
	}
</style>
