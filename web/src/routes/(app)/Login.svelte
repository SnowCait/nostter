<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import type * as Nostr from 'nostr-typedef';
	import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
	import { Login, resetLoginState } from '$lib/Login';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import { gotoAfterLogin } from '$lib/post-login-navigation';
	import { WebStorage } from '$lib/WebStorage';
	import { setLoginStatus } from '$lib/stores/LoginStatus';
	import { Dialog } from 'bits-ui';
	import NostterLogo from '$lib/components/logo/NostterLogo.svelte';

	let nostr: Nostr.Nip07.Nostr | undefined = $state();
	let key = $state('');
	let bunker = $state('');
	let name = $state('');

	let showCreateAccountDialog = $state(false);
	let showLoginDialog = $state(false);
	let failedToLogin = $state(false);
	let registering = $state(false);
	let loggingInWith: 'nip07' | 'nip46' | 'key' | undefined = $state();
	let handledQueryNpub: string | undefined;
	let loginBusy = $derived(
		loggingInWith !== undefined || registering || auth.status !== 'anonymous'
	);

	const login = new Login();

	async function resetLoginProgress(): Promise<void> {
		await resetLoginState();
		loggingInWith = undefined;
	}

	async function loginWithNip07() {
		if (loginBusy) {
			return;
		}

		loggingInWith = 'nip07';
		failedToLogin = false;
		const storage = new WebStorage(localStorage);
		storage.set('login', 'NIP-07');

		try {
			await login.withNip07();
			if (!(await gotoHome())) {
				await resetLoginProgress();
			}
		} catch (error) {
			console.error('[NIP-07 login failed]', error);
			setLoginStatus('failed', 'error');
			await resetLoginProgress();
		}
	}

	async function loginWithNip46(e: SubmitEvent) {
		e.preventDefault();
		if (loginBusy) {
			return;
		}

		loggingInWith = 'nip46';
		failedToLogin = false;
		try {
			const success = await login.withNip46(bunker);
			if (!success) {
				failedToLogin = true;
				await resetLoginProgress();
				return;
			}
			if (!(await gotoHome())) {
				await resetLoginProgress();
			}
		} catch (error) {
			console.error('[NIP-46 login failed]', error);
			setLoginStatus('failed', 'error');
			failedToLogin = true;
			await resetLoginProgress();
		}
	}

	async function loginWithKey(e: SubmitEvent) {
		e.preventDefault();
		if (loginBusy) {
			return;
		}

		loggingInWith = 'key';
		failedToLogin = false;
		try {
			if (key.startsWith('nsec')) {
				await login.withNsec(key);
			} else {
				await login.withNpub(key);
			}
			if (!(await gotoHome())) {
				await resetLoginProgress();
			}
		} catch (error) {
			console.error('[key login failed]', error);
			setLoginStatus('failed', 'error');
			await resetLoginProgress();
		}
	}

	async function loginWithDemo() {
		if (loginBusy) {
			return;
		}
		await goto('/public');
	}

	function createAccount(): void {
		const seckey = generateSecretKey();
		key = nip19.nsecEncode(seckey);
		console.log('[pubkey]', getPublicKey(seckey));
	}

	async function register(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (loginBusy) {
			return;
		}

		registering = true;
		try {
			await login.withNsec(key);
			const signer = auth.signer;
			if (signer === undefined) {
				throw new Error('Account registration did not establish a signing session');
			}
			await login.saveBasicInfo(name, signer);
			await goto('/public');
		} catch (error) {
			console.error('[register failed]', error);
			setLoginStatus('failed', 'error');
			registering = false;
			await resetLoginState();
		}
	}

	onMount(async () => {
		const { waitNostr } = await import('nip07-awaiter');
		nostr = await waitNostr(10000);
	});

	async function gotoHome(): Promise<boolean> {
		if (auth.status !== 'authenticated') {
			console.error('[login failed]');
			setLoginStatus('failed', 'error');
			return false;
		}

		await gotoAfterLogin();
		return true;
	}

	$effect(() => {
		const requestedNpub = page.url.searchParams.get('login');
		if (requestedNpub === null || !requestedNpub.startsWith('npub')) {
			handledQueryNpub = undefined;
			return;
		}

		if (requestedNpub === handledQueryNpub || loginBusy) {
			return;
		}

		handledQueryNpub = requestedNpub;
		key = requestedNpub;
		loggingInWith = 'key';
		void login
			.withNpub(requestedNpub)
			.catch(async (error) => {
				console.error('[query npub login failed]', error);
				setLoginStatus('failed', 'error');
				await resetLoginState();
			})
			.finally(() => {
				loggingInWith = undefined;
			});
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
					<Dialog.Root bind:open={showCreateAccountDialog}>
						<Dialog.Trigger onclick={createAccount}
							>{#snippet child({ props })}<button {...props}
									>{$_('login.create_account')}</button
								>{/snippet}</Dialog.Trigger
						>
						<Dialog.Portal>
							<Dialog.Overlay class="login-overlay" />
							<Dialog.Content class="card login-panel">
								<Dialog.Title class="login-a11y"
									>{$_('login.create_account')}</Dialog.Title
								>
								<Dialog.Description class="login-a11y"
									>Create a Nostr account.</Dialog.Description
								>
								<div class="dialog-content">
									{#if page.url.hostname === 'nostter.vercel.app'}
										<div>
											Site has been moved to <a href="https://nostter.app/">
												https://nostter.app/
											</a>
										</div>
									{:else}
										<div>
											<h2>{$_('login.create_account')}</h2>
											<article>
												<form onsubmit={register}>
													<div>
														<input
															type="text"
															name="name"
															placeholder={$_('login.name')}
															bind:value={name}
															disabled={registering}
														/>
													</div>
													<div class="hidden">
														<input
															type="password"
															bind:value={key}
															readonly
														/>
													</div>
													<div>
														<button
															type="submit"
															class="submit-button"
															disabled={loginBusy}
															aria-busy={registering}
														>
															{#if registering}
																<span
																	class="button-spinner"
																	aria-hidden="true"
																></span>
															{/if}
															<span>{$_('login.create')}</span>
														</button>
													</div>
												</form>
											</article>
										</div>
									{/if}
								</div>
							</Dialog.Content>
						</Dialog.Portal>
					</Dialog.Root>
				</section>

				<section>
					<button onclick={loginWithDemo} disabled={loginBusy}>
						{$_('login.try_demo')}
					</button>
				</section>

				<div class="divider-with-message">
					<div></div>
					<p>{$_('or')}</p>
					<div></div>
				</div>

				<section>
					<Dialog.Root bind:open={showLoginDialog}>
						<Dialog.Trigger
							>{#snippet child({ props })}<button {...props} class="button-outlined"
									>{$_('login.login')}</button
								>{/snippet}</Dialog.Trigger
						>
						<Dialog.Portal>
							<Dialog.Overlay class="login-overlay" />
							<Dialog.Content class="card login-panel">
								<Dialog.Title class="login-a11y">{$_('login.login')}</Dialog.Title>
								<Dialog.Description class="login-a11y"
									>Choose a browser extension, bunker, or key to sign in.</Dialog.Description
								>
								<div class="dialog-content">
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
													onclick={loginWithNip07}
													class="submit-button"
													disabled={loginBusy || nostr === undefined}
													aria-busy={loggingInWith === 'nip07'}
												>
													{#if loggingInWith === 'nip07'}
														<span
															class="button-spinner"
															aria-hidden="true"
														></span>
													{/if}
													<span>{$_('login.browser_extension')}</span>
												</button>
											</div>
										</section>

										<div class="divider-with-message">
											<div></div>
											<p>{$_('or')}</p>
											<div></div>
										</div>

										<section>
											<p class="login-recommend">{$_('login.recommended')}</p>
											<form onsubmit={loginWithNip46}>
												<div>
													<input
														type="text"
														bind:value={bunker}
														placeholder="bunker://..."
														disabled={loggingInWith !== undefined}
														required
													/>
												</div>

												<div>
													<button
														type="submit"
														class="submit-button"
														disabled={loginBusy}
														aria-busy={loggingInWith === 'nip46'}
													>
														{#if loggingInWith === 'nip46'}
															<span
																class="button-spinner"
																aria-hidden="true"
															></span>
														{/if}
														<span>{$_('login.bunker')}</span>
													</button>
												</div>
											</form>
											{#if failedToLogin}
												<p>{$_('login.failed')}</p>
											{/if}
										</section>

										<div class="divider-with-message">
											<div></div>
											<p>{$_('or')}</p>
											<div></div>
										</div>

										<section>
											<form onsubmit={loginWithKey}>
												<div>
													<input
														type="password"
														bind:value={key}
														placeholder="npub or nsec"
														pattern="^(npub|nsec)1[a-z0-9]+$"
														disabled={loggingInWith !== undefined}
														required
													/>
												</div>

												<div>
													<button
														type="submit"
														class="submit-button"
														disabled={loginBusy}
														aria-busy={loggingInWith === 'key'}
													>
														{#if loggingInWith === 'key'}
															<span
																class="button-spinner"
																aria-hidden="true"
															></span>
														{/if}
														<span>{$_('login.key')}</span>
													</button>
												</div>
											</form>
										</section>
									</article>
								</div>
							</Dialog.Content>
						</Dialog.Portal>
					</Dialog.Root>
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
	:global(.login-overlay) {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgb(0 0 0 / 40%);
		cursor: default;
	}
	:global(.login-panel) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: max-content;
		max-width: calc(100vw - 2rem);
		max-height: calc(100dvh - 2rem);
		border-radius: var(--radius);
		cursor: default;
	}
	:global(.login-a11y) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.dialog-content {
		margin: 0.5rem;
	}

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

	.submit-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 2.5rem;
	}

	.submit-button:disabled,
	input:disabled {
		cursor: progress;
		opacity: 0.72;
	}

	.button-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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
