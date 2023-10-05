<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import type { Nip07 } from 'nostr-typedef';
	import { generatePrivateKey, getPublicKey, nip19 } from 'nostr-tools';
	import { Login } from '$lib/Login';
	import { loginType } from '../stores/Author';
	import { page } from '$app/stores';
	import { afterNavigate, goto } from '$app/navigation';
	import { authorProfile } from '../stores/Author';
	import { WebStorage } from '$lib/WebStorage';
	import ModalDialog from '$lib/components/ModalDialog.svelte';

	let nostr: Nip07.Nostr | undefined;
	let key = '';
	let name = '';

	let showCreateAccountDialog = false;
	let showLoginDialog = false;

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

	async function loginWithDemo() {
		await goto('/home');
	}

	function createAccount(): void {
		showCreateAccountDialog = true;
		const seckey = generatePrivateKey();
		key = nip19.nsecEncode(seckey);
		console.log('[pubkey]', getPublicKey(seckey));
	}

	async function register(): Promise<void> {
		await login.withNsec(key);
		await login.saveBasicInfo(name);
		await gotoHome();
	}

	function showLogin(): void {
		showLoginDialog = true;
	}

	onMount(async () => {
		console.log('[login on mount]');

		const storage = new WebStorage(localStorage);
		const savedLogin = storage.get('login');
		console.log('[login]', savedLogin);

		if (savedLogin === null) {
			const { waitNostr } = await import('nip07-awaiter');
			waitNostr(10000).then((n) => (nostr = n));
		}
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

<section>
	<button on:click={createAccount}>{$_('login.create_account')}</button>
	<ModalDialog bind:open={showCreateAccountDialog}>
		<article>
			<form method="dialog" on:submit|preventDefault={register}>
				<div>
					<input
						type="text"
						name="name"
						placeholder={$_('login.name')}
						bind:value={name}
					/>
				</div>
				<div class="hidden">
					<input type="password" bind:value={key} readonly />
				</div>
				<div>
					<input
						type="submit"
						value={$_('login.create_account')}
						disabled={$loginType !== undefined}
					/>
				</div>
			</form>
		</article>
	</ModalDialog>
</section>

<section>
	<button on:click={showLogin}>{$_('login.login')}</button>
	<ModalDialog bind:open={showLoginDialog}>
		<article>
			<section>
				<div>{$_('login.recommended')}</div>
				{#if nostr === undefined}
					<p>
						Please install <a
							href="https://github.com/nostr-protocol/nips/blob/master/07.md#implementation"
							target="_blank"
							rel="noopener noreferrer"
						>
							Browser Extension
						</a>
					</p>
				{/if}
				<div>
					<button
						on:click|once={loginWithNip07}
						disabled={$loginType !== undefined || nostr === undefined}
					>
						{$_('login.browser_extension')}
					</button>
				</div>
			</section>

			<section>
				<form method="dialog" on:submit|preventDefault|once={loginWithKey}>
					<div>
						<input
							type="password"
							bind:value={key}
							placeholder="npub or nsec"
							pattern="^(npub|nsec)1[a-z0-9]+$"
							required
							on:keyup|stopPropagation={() => console.debug()}
						/>
					</div>
					<div>
						<input
							type="submit"
							value={$_('login.key')}
							disabled={$loginType !== undefined}
						/>
					</div>
				</form>
			</section>
		</article>
	</ModalDialog>
</section>

<section>
	<button on:click={loginWithDemo} disabled={$loginType !== undefined}>
		{$_('login.try_demo')}
	</button>
</section>

<style>
	section {
		margin: 1rem auto;
	}

	article {
		margin: 1rem;
		text-align: center;
	}

	form[method='dialog'] div + div {
		margin-top: 1rem;
	}

	button:disabled {
		background-color: lightgray;
	}

	button:disabled:hover {
		opacity: initial;
	}

	input::placeholder {
		text-align: center;
	}

	.hidden {
		display: none;
	}
</style>
