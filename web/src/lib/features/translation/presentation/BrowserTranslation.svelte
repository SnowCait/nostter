<script lang="ts">
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import { Dialog } from 'bits-ui';
	import {
		browserTranslationApis,
		displayLanguage,
		shouldOfferTranslation,
		translateInBrowser,
		type Availability
	} from '../application/browser-translation';

	let { text }: { text: string } = $props();
	const target = $derived(displayLanguage($locale));
	let offered = $state(false);
	let busy = $state(false);
	let result = $state('');
	let shown = $state(true);
	let error = $state('');
	let progress = $state<number>();
	let dialog = $state(false);
	let downloading = $state(false);
	let continuation = $state<() => void>();
	let rejectPreparation: ((reason: Error) => void) | undefined;
	const abort = new AbortController();
	onMount(() => {
		const api = browserTranslationApis();
		if (api) {
			void shouldOfferTranslation(api, text, target)
				.then((value) => {
					if (!abort.signal.aborted) {
						offered = value;
					}
				})
				.catch(() => {});
		}
		return () => {
			abort.abort();
			continuation = undefined;
		};
	});

	async function start() {
		const api = browserTranslationApis();
		if (!api || busy) {
			return;
		}
		busy = true;
		error = '';
		let confirmed = false;
		try {
			result = await translateInBrowser(api, text, target, {
				signal: abort.signal,
				progress: (value) => {
					progress = value;
				},
				prepare: async (availability: Availability, create) => {
					abort.signal.throwIfAborted();
					const needsConfirmation = availability !== 'available' && !confirmed;
					if (
						needsConfirmation ||
						(!navigator.userActivation.isActive && availability !== 'available')
					) {
						downloading = availability === 'downloading';
						dialog = needsConfirmation;
						return await new Promise((resolve, reject) => {
							rejectPreparation = reject;
							const onAbort = () => reject(abort.signal.reason);
							abort.signal.addEventListener('abort', onAbort, { once: true });
							continuation = () => {
								abort.signal.removeEventListener('abort', onAbort);
								continuation = undefined;
								dialog = false;
								confirmed = true;
								// Invoke create directly from the click, preserving user activation.
								create().then(resolve, reject);
							};
						});
					}
					return create();
				}
			});
			shown = true;
		} catch (cause) {
			if (!abort.signal.aborted) {
				const code = cause instanceof Error ? cause.message : '';
				error = ['same', 'uncertain', 'unavailable', 'cancelled'].includes(code)
					? code
					: 'failed';
			}
		} finally {
			if (!abort.signal.aborted) {
				busy = false;
				progress = undefined;
			}
		}
	}
	function cancel() {
		dialog = false;
		rejectPreparation?.(new Error('cancelled'));

		busy = false;
		continuation = undefined;
	}
</script>

{#if offered}
	<div class="translation">
		<button onclick={() => (result ? (shown = !shown) : start())} disabled={busy}>
			{$_(
				busy
					? 'translation.working'
					: result && shown
						? 'translation.hide'
						: 'translation.show'
			)}
		</button>
		{#if continuation && !dialog}
			<button onclick={continuation}>{$_('translation.continue')}</button>
		{/if}
		<div aria-live="polite">
			{#if progress !== undefined}<progress value={progress} max="1"></progress>{/if}
			{#if error}<p>{$_('translation.' + error)}</p>{/if}
			{#if result && shown}
				<p>{$_('translation.title')}</p>
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
