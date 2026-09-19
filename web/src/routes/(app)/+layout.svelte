<script lang="ts">
	import { now } from 'rx-nostr';
	import { WebStorage } from '$lib/WebStorage';
	import { timeline as homeTimeline } from '$lib/timelines/HomeTimeline';
	import Notice from '$lib/components/Notice.svelte';
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
	import { setOpenNoteDialog, type OpenNoteDialog } from '$lib/NoteDialogContext';
	import { fetchLastNotification } from '$lib/author/Notifications';
	import { onMount } from 'svelte';
	import Gdpr from '$lib/components/Gdpr.svelte';
	import '$lib/styles/menu.css';
	import { fetchMinutes } from '$lib/Helper';
	import { applyTheme } from '$lib/Theme';
	import { author, followees } from '$lib/stores/Author';
	import { auth } from '$lib/auth.svelte';
	import { observePageLifecycle } from '$lib/platform/browser/page-lifecycle';
	import { composerFocus } from './channels/[nevent=note]/ComposerFocus.svelte';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
	let noteDialog = $state<NoteDialog>();

	const openNoteDialog: OpenNoteDialog = async (request) => noteDialog?.open(request);
	setOpenNoteDialog(openNoteDialog);

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
	let hiddenAt: number | undefined;

	function keyboardShortcut(event: KeyboardEvent) {
		const element = event.target as HTMLElement;
		if (
			['INPUT', 'TEXTAREA'].includes(element.tagName) ||
			element.closest('dialog[open]') !== null
		) {
			return;
		}

		console.debug(
			`[${event.type}]`,
			event.code,
			event.key,
			event.ctrlKey,
			event.metaKey,
			element.tagName
		);

		if (event.key === 'n') {
			if (composerFocus.current !== undefined) {
				composerFocus.current();
			} else {
				void openNoteDialog();
			}
			event.preventDefault();
		}

		if (event.key === '1') {
			scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		}

		// Konami
		if (event.key === konamiCode[konamiIndex]) {
			console.debug('[konami]', konamiIndex);
			konamiIndex++;
		} else {
			konamiIndex = 0;
		}
		if (konamiIndex === konamiCode.length) {
			console.debug('[konami command]');
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
		switch (document.visibilityState) {
			case 'hidden': {
				hiddenAt = now();
				break;
			}
			case 'visible': {
				if (hiddenAt !== undefined) {
					const visibleAt = now();
					if (visibleAt - hiddenAt > fetchMinutes($followees.length) * 60) {
						homeTimeline.clear();
						homeTimeline.older();
					} else if (visibleAt > hiddenAt) {
						homeTimeline.retrieve(visibleAt, hiddenAt);
					}
				}
				break;
			}
		}
	}

	onMount(() => {
		subscribeSystemTheme();
		return observePageLifecycle();
	});

	let initialized = false;
	$effect(() => {
		if (!auth.isAuthenticated || $author === undefined || initialized) {
			return;
		}
		initialized = true;
		fetchLastNotification();
		homeTimeline.subscribe();
	});

	function subscribeSystemTheme(): void {
		const storage = new WebStorage(localStorage);
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			const t = storage.get('theme') ?? 'system';

			if (t !== 'system') {
				return;
			}

			applyTheme('system');
		});
	}
</script>

<svelte:window onkeydown={keyboardShortcut} />
<svelte:document onvisibilitychange={onVisibilityChange} />

<svelte:head>
	<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</svelte:head>

<div class="app-shell">
	<Notice />

	<div class="app">
		<NoteDialog bind:this={noteDialog} />

		<header>
			<div>
				<Header />
			</div>
		</header>

		<main>
			{@render children?.()}
		</main>
	</div>
</div>

<Gdpr />

<style>
	.app-shell {
		--app-shell-mobile-top-bar-height: 3.125rem;
		--app-shell-mobile-bottom-bar-height: 3.125rem;
		--app-shell-mobile-bottom-offset: calc(
			var(--app-shell-mobile-bottom-bar-height) + env(safe-area-inset-bottom)
		);
	}

	.app {
		max-width: 926px;
		margin: 0 auto;
		padding: 0 2.25rem;
		display: grid;
		grid-template-columns: 220px minmax(0, 598px);
		gap: 2.25rem;
	}

	header {
		grid-column: 1 / 2;
		position: sticky;
		top: 0;
		align-self: start;
		max-width: 220px;
		width: 100%;
		height: 100vh;
		box-sizing: border-box;
		padding-top: 0.5rem;
		z-index: 3;
		overflow-y: auto;
	}

	main {
		margin: 0 auto;
		grid-column: 2 / 3;
		max-width: 598px;
		min-width: 0;
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
			max-width: 744px;
			gap: 1.5rem;
			grid-template-columns: 3.125rem minmax(0, 1fr);
		}

		header {
			max-width: 3.125rem;
		}
	}

	@media screen and (max-width: 600px) {
		.app {
			margin: 0 auto var(--app-shell-mobile-bottom-bar-height) 0;
			padding: 0;
			display: block;
		}

		header {
			width: 0;
			position: fixed;
			top: auto;
			align-self: auto;
			height: 100%;
			margin-top: 0.5rem;
			padding-top: 0;
		}

		main {
			margin-left: auto;
			padding-bottom: var(--app-shell-mobile-bottom-bar-height);
			margin-top: var(--app-shell-mobile-top-bar-height);
			height: auto;
		}

		:global(.card) {
			border-radius: 0;
			border: none;
		}
	}
</style>
