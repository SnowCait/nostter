<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import IconExternalLink from '@tabler/icons-svelte-runes/icons/external-link';
	import { googleTranslationUrl } from '../application/google-translation';
	import { Dialog } from 'bits-ui';
	import {
		browserTranslationApis,
		preferredTranslationLanguage,
		shouldOfferTranslation,
		translateInBrowser
	} from '../application/browser-translation';

	let {
		text,
		getDisplayName
	}: { text: string; getDisplayName: (pubkey: string) => string | undefined } = $props();
	let target = $state<string>();
	let offered = $state(false);
	let busy = $state(false);
	let result = $state('');
	let shown = $state(true);
	let error = $state('');
	let phase = $state<'preparing' | 'translating'>();
	let dialog = $state(false);
	let downloading = $state(false);
	let continuation = $state<() => void>();

	let fallback = $state(false);
	let operation: AbortController | undefined;
	onMount(() => {
		const updateTarget = () => {
			target = preferredTranslationLanguage(navigator);
		};
		updateTarget();
		window.addEventListener('languagechange', updateTarget);
		return () => window.removeEventListener('languagechange', updateTarget);
	});
	$effect(() => {
		const translationTarget = target;
		offered = false;
		result = '';
		error = '';
		fallback = false;
		if (!translationTarget) {
			return;
		}
		const lifetime = new AbortController();
		const api = browserTranslationApis();
		if (api) {
			void shouldOfferTranslation(api, text, translationTarget, lifetime.signal)
				.then((value) => {
					if (!lifetime.signal.aborted) {
						offered = value;
					}
				})
				.catch(() => {});
		}
		return () => {
			lifetime.abort();
			operation?.abort();
		};
	});

	async function start() {
		const api = browserTranslationApis();
		if (!api || busy || !target) {
			return;
		}
		const current = new AbortController();
		operation = current;
		const signal = current.signal;
		busy = true;
		error = '';
		fallback = false;
		let confirmed = false;

		async function waitForInput() {
			try {
				await new Promise<void>((resolve, reject) => {
					const onAbort = () => reject(signal.reason);
					signal.addEventListener('abort', onAbort, { once: true });
					continuation = () => {
						signal.removeEventListener('abort', onAbort);
						continuation = undefined;
						resolve();
					};
				});
				signal.throwIfAborted();
			} finally {
				if (operation === current) {
					continuation = undefined;
					dialog = false;
				}
			}
		}
		try {
			const translated = await translateInBrowser(api, text, target, {
				signal,
				translating: () => {
					if (!signal.aborted) {
						phase = 'translating';
					}
				},
				prepare: async (availability, create) => {
					signal.throwIfAborted();
					if (availability !== 'available' && !confirmed) {
						downloading = availability === 'downloading';
						dialog = true;
						await waitForInput();
						confirmed = true;
					}
					try {
						if (availability !== 'available') {
							phase = 'preparing';
						}
						return await create();
					} catch (cause) {
						signal.throwIfAborted();
						// Translator downloads can still require transient activation.
						// Retry only after the API actually rejects, rather than predicting it.
						if (!(cause instanceof DOMException) || cause.name !== 'NotAllowedError') {
							throw cause;
						}
						phase = undefined;
						await waitForInput();
						if (availability !== 'available') {
							phase = 'preparing';
						}
						return await create();
					} finally {
						if (!signal.aborted) {
							phase = undefined;
						}
					}
				}
			});
			if (!signal.aborted) {
				fallback = translated === undefined;
				result = translated ?? '';
				shown = true;
			}
		} catch (cause) {
			if (!signal.aborted) {
				const code = cause instanceof Error ? cause.message : '';
				error = ['same', 'unavailable'].includes(code) ? code : 'failed';
			}
		} finally {
			if (operation === current) {
				operation = undefined;
				busy = false;
				phase = undefined;
			}
		}
	}
	function cancel() {
		operation?.abort();
	}
</script>

{#if offered}
	<div class="translation">
		<button
			class="translation-toggle"
			onclick={() => (result ? (shown = !shown) : start())}
			disabled={busy}
		>
			{$_(result && shown ? 'translation.hide' : 'translation.show')}
		</button>
		{#if continuation && !dialog}
			<button onclick={continuation}>{$_('translation.continue')}</button>
		{/if}
		<div aria-live="polite">
			{#if phase}<p>{$_('translation.' + phase)}</p>{/if}
			{#if fallback}
				<p>{$_('translation.undetected')}</p>
				<a
					class="fallback-link"
					href={googleTranslationUrl(text, $_('thread.translation.url'), getDisplayName)}
					target="_blank"
					rel="noopener noreferrer"
				>
					{$_('translation.google')}
					<IconExternalLink size={16} />
				</a>
			{/if}
			{#if error}<p>{$_('translation.' + error)}</p>{/if}
			{#if result && shown}
				<p class="result" lang={target}>{result}</p>
			{/if}
		</div>
	</div>
{/if}
<Dialog.Root
	bind:open={dialog}
	onOpenChange={(open) => {
		if (!open && continuation) {
			cancel();
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="translation-overlay" />
		<Dialog.Content class="translation-dialog card">
			<Dialog.Title class="translation-dialog-title">{$_('translation.title')}</Dialog.Title>
			<Dialog.Description class="translation-description"
				>{$_('translation.description')}</Dialog.Description
			>
			<p class="translation-caution">{$_('translation.caution')}</p>
			{#if downloading}<p>{$_('translation.downloading')}</p>{/if}
			<div class="translation-dialog-actions">
				<button class="button-outlined" onclick={cancel}>{$_('translation.cancel')}</button>
				<button onclick={continuation}>{$_('translation.start')}</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.translation {
		margin-top: 0.5rem;
	}
	button.translation-toggle {
		background: transparent;
		border: 0;
		border-radius: 0;
		padding: 0;
		color: var(--blue);
		font-size: 0.85em;
		font-weight: normal;
	}
	button.translation-toggle:hover:not(:disabled) {
		text-decoration: underline;
		opacity: 1;
	}
	button.translation-toggle:focus-visible {
		outline: 2px solid var(--blue);
		outline-offset: 3px;
	}
	button.translation-toggle:disabled {
		cursor: default;
	}
	.result {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	:global(.translation-overlay) {
		position: fixed;
		inset: 0;
		background: #0008;
		z-index: 10;
	}
	:global(.translation-dialog) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(calc(100vw - 2rem), 30rem);
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		box-sizing: border-box;
		color: var(--surface-foreground);
		background: var(--surface);
		padding: 1.5rem;
		z-index: 11;
	}

	:global(.translation-dialog-title) {
		margin: 0 0 1rem;
		font-size: 1.25rem;
		font-weight: 700;
	}
	:global(.translation-description) {
		margin: 0;
		line-height: 1.6;
	}
	.translation-caution {
		color: var(--secondary-accent);
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0.75rem 0 0;
	}
	.translation-dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}
	.translation-dialog-actions button {
		padding: 0.6rem 1rem;
	}
	.fallback-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--blue);
		text-decoration: underline;
	}
	@media (max-width: 360px) {
		:global(.translation-dialog) {
			padding: 1rem;
		}
		.translation-dialog-actions {
			gap: 0.5rem;
		}
		.translation-dialog-actions button {
			padding: 0.6rem 0.75rem;
		}
	}
</style>
