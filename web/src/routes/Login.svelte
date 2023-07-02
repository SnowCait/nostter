<script lang="ts">
	import { onMount } from 'svelte';
	import { Login } from '$lib/Login';
	import { loginType } from '../stores/Author';
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';

	const demoNpub = 'npub1pp79ruvjd7xned8lgh6n4rhz4pg3els3x5n6kr58l8zcyysp5c0qrkan2p';

	let key = '';

	const login = new Login();

	function loginWithDemo() {
		if (key !== '' && !confirm('Key is not empty. Override?')) {
			return;
		}
		key = demoNpub;
	}

	onMount(async () => {
		console.log('onMount');

		const savedLogin = localStorage.getItem('nostter:login');
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
	});

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

<button on:click|once={() => login.withNip07()} disabled={$loginType !== undefined}>
	Login with NIP-07 Browser Extension
</button>
<span>(Recommended)</span>

<div>or</div>

<form
	on:submit|preventDefault|once={() =>
		key.startsWith('nsec') ? login.withNsec(key) : login.withNpub(key)}
>
	<input
		type="text"
		bind:value={key}
		placeholder="npub or nsec"
		pattern="^(npub|nsec)1[a-z0-9]+$"
		required
		on:keyup|stopPropagation={() => console.debug()}
	/>
	<input type="submit" value="Login with key" disabled={$loginType !== undefined} />

	<button on:click={loginWithDemo} disabled={$loginType !== undefined}>Try demo</button>
</form>
