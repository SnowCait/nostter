<script lang="ts">
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
	import { openNoteDialog } from '../stores/NoteDialog';
	import { onMount } from 'svelte';
	import { debugMode } from '../stores/Preference';
	import ReloadDialog from './ReloadDialog.svelte';
	import { pubkey } from '../stores/Author';
	import { _ } from 'svelte-i18n';
	import '../app.css';

	let debugMessage = '';
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
		debugMessage += `${new Date().toLocaleTimeString()} [visibilitychange] ${
			document.visibilityState
		}\n`;
		switch (document.visibilityState) {
			case 'hidden': {
				break;
			}
			case 'visible': {
				reloadDialogComponent.tryOpen();
				break;
			}
		}
	}

	onMount(() => {
		document.addEventListener('visibilitychange', onVisibilityChange);
	});
</script>

<svelte:window on:keyup={keyboardShortcut} />

<div class="app">
	<NoteDialog />
	<ReloadDialog bind:this={reloadDialogComponent} />

	{#if $debugMode}
		<section class="debug">
			<pre>{debugMessage}</pre>
		</section>
	{/if}

	<header>
		<div>
			<Header onClickPostButton={() => ($openNoteDialog = !$openNoteDialog)} />
		</div>
	</header>

	<main>
		<slot />
	</main>
</div>

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
	}

	.debug {
		position: fixed;
		bottom: 0;
		background-color: white;
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

		main {
			margin-left: auto;
			margin-bottom: 50px;
		}

		.debug {
			bottom: 50px;
			overflow: auto;
		}
	}

	:global(article.timeline-item) {
		padding: 12px 16px;
		font-family: 'Segoe UI', Meiryo, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
	}

	:global(article.timeline-item + article.timeline-item) {
		padding-top: 0;
	}

	:global(blockquote) {
		margin: 0.5em 0;
		border: var(--default-border);
		border-radius: 5px;
		overflow: hidden;
	}

	:global(ul.clear) {
		list-style: none;
		padding: 0;
	}

	:global(button, input[type='button'], input[type='submit']) {
		padding: 0.6rem 1.5rem;
		border-radius: 9999px;
		background-color: var(--accent);
		color: var(--accent-foreground);
		font-weight: bold;
		cursor: pointer;
	}

	:global(button:hover, input[type='button']:hover, input[type='submit']:hover) {
		opacity: 0.75;
	}

	:global(
			button.button-small,
			input[type='button'].button-small,
			input[type='submit'].button-small
		) {
		padding: 0.2rem 0.85rem;
	}

	:global(
			input[type='text'],
			input[type='email'],
			input[type='number'],
			input[type='password'],
			input[type='search'],
			input[type='tel'],
			input[type='url'],
			textarea
		) {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		outline-style: none;
		background-color: var(--surface);
	}

	:global(
			input[type='text'],
			input[type='email'],
			input[type='number'],
			input[type='password'],
			input[type='search'],
			input[type='tel'],
			input[type='url']
		) {
		border: var(--default-border);
	}

	:global(button.clear) {
		background-color: transparent;
		border: none;
		cursor: pointer;
		outline: none;
		padding: 0;
		width: inherit;
		height: inherit;
	}

	:global(.card) {
		background-color: var(--surface);
		color: var(--surface-foreground);
		padding: 1rem;
		border-radius: 0.5rem;
		border: var(--default-border);
	}

	:global(a) {
		color: var(--accent-gray);
	}

	:global(a[target='_blank']) {
		color: var(--accent-gray);
		text-decoration-line: underline;
	}

	@keyframes -global-rotation {
		0% {
			transform: rotate(0);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
