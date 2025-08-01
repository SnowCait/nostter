<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import type { Nip07 } from 'nostr-typedef';
	import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
	import { Login } from '$lib/Login';
	import { loginType } from '$lib/stores/Author';
	import { page } from '$app/stores';
	import { afterNavigate, goto } from '$app/navigation';
	import { authorProfile } from '$lib/stores/Author';
	import { WebStorage } from '$lib/WebStorage';
	import ModalDialog from '$lib/components/ModalDialog.svelte';
	import NostterLogo from '$lib/components/logo/NostterLogo.svelte';

	let nostr: Nip07.Nostr | undefined;
	let key = '';
	let name = '';

	let showCreateAccountDialog = false;
	let showLoginDialog = false;

	const login = new Login();

	async function loginWithNip07() {
		const storage = new WebStorage(localStorage);
		storage.set('login', 'NIP-07');

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
		await goto('/public');
	}

	function createAccount(): void {
		showCreateAccountDialog = true;
		const seckey = generateSecretKey();
		key = nip19.nsecEncode(seckey);
		console.log('[pubkey]', getPublicKey(seckey));
	}

	async function register(): Promise<void> {
		await login.withNsec(key);
		await login.saveBasicInfo(name);
		await goto('/public');
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

<div class="login-wrapper">
	<div class="login">
		<div class="logo">
			<NostterLogo />
		</div>
		<div class="messages-and-actions">
			<p class="hero-message">
				{$_('login.hero-message')}<img
					src="https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u1f431/u1f431_u1f383.png"
					alt="cute pumpkin cat emoji"
				/>
			</p>
			<p class="hero-message-sub">
				{$_('login.hero-message-sub')}
			</p>

			<div class="actions">
				<section>
					<button on:click={createAccount}>{$_('login.create_account')}</button>
					<ModalDialog bind:open={showCreateAccountDialog}>
						{#if $page.url.hostname === 'nostter.vercel.app'}
							<div>
								Site has been moved to <a href="https://nostter.app/">
									https://nostter.app/
								</a>
							</div>
						{:else}
							<div>
								<h2>{$_('login.create_account')}</h2>
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
												value={$_('login.create')}
												disabled={$loginType !== undefined}
											/>
										</div>
									</form>
								</article>
							</div>
						{/if}
					</ModalDialog>
				</section>

				<section>
					<button on:click={loginWithDemo} disabled={$loginType !== undefined}>
						{$_('login.try_demo')}
					</button>
				</section>

				<div class="divider-with-message">
					<div />
					<p>{$_('or')}</p>
					<div />
				</div>

				<section>
					<button class="button-outlined" on:click={showLogin}>{$_('login.login')}</button
					>
					<ModalDialog bind:open={showLoginDialog}>
						<article class="login-modal-content">
							<section>
								<p class="login-recommend">{$_('login.recommended')}</p>
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
										on:click={loginWithNip07}
										disabled={$loginType !== undefined || nostr === undefined}
									>
										{$_('login.browser_extension')}
									</button>
								</div>
							</section>

							<div class="divider-with-message">
								<div />
								<p>{$_('or')}</p>
								<div />
							</div>

							<section>
								<form method="dialog" on:submit|preventDefault={loginWithKey}>
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
			</div>
		</div>
	</div>
</div>

<footer>
	<p>
		© 2023 🐾 nostter, <a
			href="/npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw"
		>
			@SnowCait
		</a>
	</p>
</footer>

<style>
	h2 {
		font-size: 2rem;
	}

	.login-wrapper {
		position: fixed;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: calc(100% - 46px);
		align-items: center;
		justify-content: center;
		overflow-y: scroll;
		margin-bottom: 46px;
	}

	footer {
		position: fixed;
		bottom: 0;
		width: 100%;
		border-top: var(--default-border);
		padding: 0.75rem;
		margin: 0 auto;
		text-align: center;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--accent);
		background: var(--background);
	}

	.login {
		display: flex;
		justify-content: center;
		max-width: 984px;
		width: 100%;
		gap: 3rem;
		margin: 0 auto;
		padding: 2rem;
		position: absolute;
	}

	.login .logo {
		width: 100%;
		max-width: 360px;
		margin: auto;
	}

	.messages-and-actions {
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}

	.hero-message {
		font-size: 4rem;
		font-weight: 600;
		line-height: 1.05;
	}

	.hero-message > img {
		vertical-align: bottom;
		width: 4.5rem;
		height: 4.5rem;
	}

	.hero-message-sub {
		font-size: 1.2rem;
		color: var(--accent);
		word-wrap: break-word;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 320px;
	}

	.divider-with-message {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--accent-gray);
	}

	.divider-with-message > div {
		width: 100%;
		border-top: var(--default-border);
	}

	.divider-with-message > p {
		white-space: nowrap;
		text-align: center;
	}

	button {
		width: 100%;
	}

	article {
		margin-top: 1rem;
	}

	.login-modal-content section {
		margin: 1rem 0;
	}

	.login-modal-content section > * {
		margin: 0.5rem 0;
	}

	.login-recommend {
		font-weight: 600;
		color: var(--accent);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	input[type='text'],
	input[type='password'] {
		min-width: 280px;
	}

	.hidden {
		display: none;
	}

	a {
		text-decoration-line: underline;
	}

	@media screen and (max-width: 860px) {
		:global(main) {
			padding-bottom: 0;
		}

		.login {
			flex-direction: column;
			gap: 1.5rem;
		}

		.login img {
			max-width: 220px;
		}

		.messages-and-actions {
			gap: 1.5rem;
		}
	}

	@media screen and (max-width: 600px) {
		.hero-message {
			font-size: 3rem;
		}

		.hero-message > img {
			width: 3.5rem;
			height: 3.5rem;
		}

		.hero-message-sub {
			font-size: 1.1rem;
		}

		.actions {
			max-width: 100%;
		}
	}

	@media screen and (max-height: 576px) {
		.login {
			top: 0;
		}
	}
</style>
