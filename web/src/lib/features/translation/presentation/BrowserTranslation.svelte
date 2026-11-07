<script lang="ts">
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import { Dialog } from 'bits-ui';
	import {
		browserTranslationApis,
		displayLanguage,
		shouldOfferTranslation,
		translateInBrowser
	} from '../application/browser-translation';

	let { text }: { text: string } = $props();
	const target = $derived(displayLanguage($locale));
	let offered = $state(false);
	let busy = $state(false);
	let result = $state('');
	let shown = $state(true);
	let error = $state('');
	let phase = $state<'preparing' | 'translating'>();
	let dialog = $state(false);
	let downloading = $state(false);
	let continuation = $state<() => void>();

	let choosingSource = $state(false);
	let sourceLanguage = $state('');
	const lifetime = new AbortController();
	let operation: AbortController | undefined;
	onMount(() => {
		const api = browserTranslationApis();
		if (api) {
			void shouldOfferTranslation(api, text, target, lifetime.signal)
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
		if (!api || busy) {
			return;
		}
		const current = new AbortController();
		operation = current;
		const signal = current.signal;
		busy = true;
		error = '';
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
					choosingSource = false;
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
				chooseSource: async () => {
					choosingSource = true;
					await waitForInput();
					return Intl.getCanonicalLocales(sourceLanguage)[0];
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
				result = translated;
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
		{#if choosingSource}
			<form
				onsubmit={(event) => {
					event.preventDefault();
					continuation?.();
				}}
			>
				<label>
					{$_('translation.source')}
					<input
						bind:value={sourceLanguage}
						required
						pattern={'[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*'}
						placeholder="en, ja, fr…"
					/>
				</label>
				<button type="submit">{$_('translation.start')}</button>
				<button type="button" onclick={cancel}>{$_('translation.cancel')}</button>
			</form>
		{:else if continuation && !dialog}
			<button onclick={continuation}>{$_('translation.continue')}</button>
		{/if}
		<div aria-live="polite">
			{#if phase}<p>{$_('translation.' + phase)}</p>{/if}
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
			<Dialog.Title>{$_('translation.title')}</Dialog.Title>
			<Dialog.Description class="translation-description"
				>{$_('translation.description')}</Dialog.Description
			>
			{#if downloading}<p>{$_('translation.downloading')}</p>{/if}
			<button onclick={cancel}>{$_('translation.cancel')}</button>
			<button onclick={continuation}>{$_('translation.start')}</button>
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
		width: min(90vw, 30rem);
		padding: 1rem;
		z-index: 11;
	}
	:global(.translation-description) {
		white-space: pre-line;
	}
</style>
