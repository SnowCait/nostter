<script lang="ts">
	import { createRxOneshotReq, latest } from 'rx-nostr';
	import { WebStorage } from '$lib/WebStorage';
	import { notificationKinds } from '$lib/NotificationTimeline';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import Notice from '$lib/components/Notice.svelte';
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
	import { openNoteDialog } from '../../stores/NoteDialog';
	import { pubkey } from '../../stores/Author';
	import { lastReadAt, lastNotifiedAt } from '../../stores/Notifications';
	import { onMount } from 'svelte';
	import ReloadDialog from './ReloadDialog.svelte';
	import Gdpr from './parts/Gdpr.svelte';

	let reloadDialogComponent: ReloadDialog;
	const konamiCode = [
		'ArrowUp',
		'ArrowUp',
		'ArrowDown',
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight',
		'ArrowLeft',
		'ArrowRight',
		'b',
		'a'
	];
	let konamiIndex = 0;

	checkNotifications();

	function checkNotifications(): void {
		const notificationExistsReq = createRxOneshotReq({
			filters: [
				{
					kinds: notificationKinds,
					'#p': [$pubkey],
					since: $lastReadAt,
					limit: 1
				}
			]
		});
		rxNostr
			.use(notificationExistsReq)
			.pipe(latest())
			.subscribe((packet) => {
				console.log('[rx-nostr notification packet]', packet);
				$lastNotifiedAt = packet.event.created_at;
			});
	}

	function keyboardShortcut(event: KeyboardEvent) {
		console.debug(`[${event.type}]`, event.code, event.key, event.ctrlKey, event.metaKey);

		if (event.key === 'n') {
			$openNoteDialog = true;
		}

		if (event.key === '1') {
			scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		}

		// Konami
		if (event.key === konamiCode[konamiIndex]) {
			console.log('[konami]', konamiIndex);
			konamiIndex++;
		} else {
			konamiIndex = 0;
		}
		if (konamiIndex === konamiCode.length) {
			console.log('[konami command]');
			konamiIndex = 0;
			rotateLogo();
		}
	}

	function rotateLogo() {
		const logoIconElem = document.getElementById('logo-icon');
		if (!logoIconElem) return;
		logoIconElem.style.animation = '1.5s linear infinite rotation';
		setTimeout(() => {
			logoIconElem.style.animation = '';
		}, 4500); // 3 times
	}

	function onVisibilityChange() {
		console.log('[visibilitychange]', document.visibilityState);
		switch (document.visibilityState) {
			case 'hidden': {
				break;
			}
			case 'visible': {
				setTimeout(() => reloadDialogComponent.tryOpen(), 1000);
				break;
			}
		}
	}

	onMount(() => {
		subscribeSystemTheme();
	});

	function subscribeSystemTheme(): void {
		const storage = new WebStorage(localStorage);
		window
			.matchMedia('(prefers-color-scheme: dark)')
			.addEventListener('change', (e: MediaQueryList | MediaQueryListEvent) => {
				const t = storage.get('theme') ?? 'system';

				if (t !== 'system') {
					return;
				}

				if (e.matches) {
					console.log('[theme system]', 'dark');
					document.documentElement.classList.add('dark');
				} else {
					console.log('[theme system]', 'light');
					document.documentElement.classList.remove('dark');
				}
			});
	}
</script>

<svelte:window on:keyup={keyboardShortcut} />
<svelte:document on:visibilitychange={onVisibilityChange} />

<svelte:head>
	<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</svelte:head>

<Notice />

<div class="app">
	<NoteDialog />
	<ReloadDialog bind:this={reloadDialogComponent} />

	<header>
		<div>
			<Header />
		</div>
	</header>

	<main>
		<slot />
	</main>
</div>

<Gdpr />

<style>
	.app {
		max-width: 926px;
		margin: 2.25rem auto;
		padding: 0 2.25rem;
		display: grid;
		grid-template-columns: 220px 598px;
		gap: 2.25rem;
	}

	header {
		position: fixed;
		max-width: 220px;
		width: 100%;
		height: 100%;
		z-index: 3;
	}

	main {
		margin: 0 auto;
		grid-column: 2 / 3;
		max-width: 598px;
		width: 100%;
	}

	@keyframes -global-rotation {
		0% {
			transform: rotate(0);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@media screen and (max-width: 926px) {
		.app {
			max-width: calc(926px - (220px - 2.25rem));
			gap: 1.5rem;
			grid-template-columns: 3.125rem auto;
		}

		header {
			max-width: 3.125rem;
		}
	}

	@media screen and (max-width: 600px) {
		.app {
			margin: 0 auto 50px 0;
			padding: 0;
			display: block;
		}

		header {
			width: 0;
		}

		main {
			margin-left: auto;
			padding-bottom: 3.125rem;
			margin-top: 3.125rem;
			height: auto;
		}

		:global(.card) {
			border-radius: 0;
			border: none;
		}
	}
</style>
