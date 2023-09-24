<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { Login } from '$lib/Login';
	import { loginType } from '../stores/Author';
	import { page } from '$app/stores';
	import { afterNavigate, goto } from '$app/navigation';
	import { japaneseBotNpub } from '$lib/Constants';
	import { authorProfile } from '../stores/Author';
	import { WebStorage } from '$lib/WebStorage';

	let key = '';

	const login = new Login();

	async function loginWithNip07() {
		await login.withNip07();
		await gotoHome();
	}

	async function loginWithKey() {
		if (key.startsWith('nsec')) {
			await login.withNsec(key);
		} else {
			await login.withNpub(key);
		}
		await gotoHome();
	}

	function loginWithDemo() {
		if (key !== '' && !confirm('Key is not empty. Override?')) {
			return;
		}
		key = japaneseBotNpub;
	}

	async function createAccount() {
		await login.generateNsec();
		await gotoProfile();
	}

	onMount(async () => {
		console.log('onMount');

		const storage = new WebStorage(localStorage);
		const savedLogin = storage.get('login');
		console.log('[login]', savedLogin);

		if (savedLogin === null) {
			return;
		}

		if (savedLogin === 'NIP-07') {
			await login.withNip07();
		} else if (savedLogin.startsWith('nsec')) {
			await login.withNsec(savedLogin);
		} else if (savedLogin.startsWith('npub')) {
			await login.withNpub(savedLogin);
		} else {
			console.error('[logic error]', 'login');
		}
		await gotoHome();
	});

	async function gotoHome() {
		console.log('[goto home]', $authorProfile);
		if ($authorProfile === undefined) {
			console.error('[login failed]');
			return;
		}

		const url = '/home';
		console.log(`Redirect to ${url}`);
		await goto(url);
	}

	async function gotoProfile() {
		const url = '/profile';
		console.log(`Redirect to ${url}`);
		await goto(url);
	}

	afterNavigate(async () => {
		console.log('afterNavigate');
		const queryNpub = $page.url.searchParams.get('login');

		if (queryNpub === null || !queryNpub.startsWith('npub') || $loginType !== undefined) {
			return;
		}

		key = queryNpub;
		await login.withNpub(queryNpub);
	});
</script>

<button on:click|once={loginWithNip07} disabled={$loginType !== undefined}>
	{$_('login.browser_extension')}
</button>
<span>{$_('login.recommended')}</span>

<div>or</div>

<form on:submit|preventDefault|once={loginWithKey}>
	<input
		type="password"
		bind:value={key}
		placeholder="npub or nsec"
		pattern="^(npub|nsec)1[a-z0-9]+$"
		required
		on:keyup|stopPropagation={() => console.debug()}
	/>
	<input type="submit" value={$_('login.key')} disabled={$loginType !== undefined} />

	<button on:click={loginWithDemo} disabled={$loginType !== undefined}>
		{$_('login.try_demo')}
	</button>
</form>

<div>or</div>

<form on:submit|preventDefault|once={createAccount}>
	<input type="submit" value={$_('login.create_account')} disabled={$loginType !== undefined} />
</form>
