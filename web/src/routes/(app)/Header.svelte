<script lang="ts">
	import { IconLogin, IconPencilPlus } from '@tabler/icons-svelte-runes';
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { followees } from '$lib/stores/Author';
	import { getOpenNoteDialog } from '$lib/NoteDialogContext';
	import NostterLogo from '$lib/components/logo/NostterLogo.svelte';
	import NostterLogoIcon from '$lib/components/logo/NostterLogoIcon.svelte';
	import { composerFocus } from './channels/[nevent=note]/ComposerFocus.svelte';
	import AppNavigation from './navigation/AppNavigation.svelte';
	const openNoteDialog = getOpenNoteDialog();

	function onClickPostButton(): void {
		void openNoteDialog();
	}

	let homeLink = $derived(
		$followees.filter((x) => x !== auth.pubkey).length > 0 ? '/home' : '/public'
	);
</script>

<div class="header">
	<div id="logo-icon-wrapper">
		<a href={auth.pubkey !== undefined ? homeLink : '/'} id="logo-icon">
			<div class="logo-for-mobile">
				<NostterLogoIcon />
			</div>
			<div class="logo-for-desktop">
				<NostterLogo />
			</div>
		</a>
	</div>
	<AppNavigation pubkey={auth.pubkey} {homeLink} />
	{#if auth.signer !== undefined}
		<button
			class:inline-composer-active={composerFocus.current !== undefined}
			title="{$_('post')} (N)"
			onclick={onClickPostButton}
		>
			<IconPencilPlus size={30} />
			<p>{$_('post')}</p>
		</button>
	{:else if auth.pubkey === undefined}
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
			height: var(--app-shell-mobile-bottom-offset);
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
			height: var(--app-shell-mobile-top-bar-height);
			padding: auto;
			display: flex;
			justify-content: center;
			align-items: center;
		}

		.header > button {
			position: fixed;
			bottom: calc(var(--app-shell-mobile-bottom-offset) + 0.75rem);
			right: 0.75rem;
		}

		.header > button.inline-composer-active {
			display: none;
		}
	}
</style>
