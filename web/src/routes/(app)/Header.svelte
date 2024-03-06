<script lang="ts">
	import IconHome from '@tabler/icons-svelte/dist/svelte/icons/IconHome.svelte';
	import IconSearch from '@tabler/icons-svelte/dist/svelte/icons/IconSearch.svelte';
	import IconBell from '@tabler/icons-svelte/dist/svelte/icons/IconBell.svelte';
	import IconUser from '@tabler/icons-svelte/dist/svelte/icons/IconUser.svelte';
	import IconSettings from '@tabler/icons-svelte/dist/svelte/icons/IconSettings.svelte';
	import IconBookmark from '@tabler/icons-svelte/dist/svelte/icons/IconBookmark.svelte';
	import IconMessages from '@tabler/icons-svelte/dist/svelte/icons/IconMessages.svelte';
	import IconPencilPlus from '@tabler/icons-svelte/dist/svelte/icons/IconPencilPlus.svelte';
	import IconLogin from '@tabler/icons-svelte/dist/svelte/icons/IconLogin.svelte';
	import IconDots from '@tabler/icons-svelte/dist/svelte/icons/IconDots.svelte';
	import IconPaw from '@tabler/icons-svelte/dist/svelte/icons/IconPaw.svelte';
	import { nip19 } from 'nostr-tools';
	import { lastReadAt, lastNotifiedAt, unreadEventItems } from '../../stores/Notifications';
	import { followees, pubkey, rom } from '../../stores/Author';
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { openNoteDialog } from '../../stores/NoteDialog';
	import NostterLogo from './parts/NostterLogo.svelte';
	import NostterLogoIcon from './parts/NostterLogoIcon.svelte';

	async function onClickPostButton(): Promise<void> {
		$openNoteDialog = !$openNoteDialog;
	}

	let show = false;

	$: mobile = browser && window.matchMedia('(max-width: 600px)').matches;
	$: homeLink = $followees.filter((x) => x !== $pubkey).length > 0 ? '/home' : '/trend';
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
		<ul>
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
						{#if $unreadEventItems.length > 0 || $lastNotifiedAt > $lastReadAt}
							<span class="notifications-icon-badge" />
						{/if}
						<p>{$_('layout.header.notifications')}</p>
					</li>
				</a>
				<a href="/{nip19.npubEncode($pubkey)}">
					<li>
						<IconUser size={30} />
						<p>{$_('layout.header.profile')}</p>
					</li>
				</a>
			{/if}
			{#if mobile && $pubkey}
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
				<li on:click={() => (show = !show)}>
					<IconDots size={30} />
					<p>...</p>
				</li>
			{/if}
			{#if !mobile || show || !$pubkey}
				{#if $pubkey}
					<a href="/{nip19.npubEncode($pubkey)}/bookmarks">
						<li>
							<IconBookmark size={30} />
							<p>{$_('layout.header.bookmarks')}</p>
						</li>
					</a>
				{/if}
				<a href="/channels">
					<li>
						<IconMessages size={30} />
						<p>{$_('layout.header.channels')}</p>
					</li>
				</a>
				{#if $pubkey}
					<a href="/preferences">
						<li>
							<IconSettings size={30} />
							<p>{$_('layout.header.preferences')}</p>
						</li>
					</a>
				{/if}
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
		<button on:click={onClickPostButton}>
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
		top: 2.25rem;
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

		li p {
			display: none;
		}
	}
</style>
