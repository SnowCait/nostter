<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { remoteSigner } from '$lib/RemoteSigner';
	import { copy as copyToClipboard } from '$lib/platform/browser/clipboard';
	import { IconCheck } from '@tabler/icons-svelte-runes';
	import { page } from '$app/state';

	interface Props {
		canEnable: boolean;
	}

	let { canEnable }: Props = $props();

	let enabled = $state(remoteSigner.enabled);
	let copied = $state(false);

	function enable(): void {
		if (!canEnable) {
			return;
		}

		remoteSigner.enable();
		remoteSigner.subscribeIfEnabled();
		enabled = true;
	}

	function disable(): void {
		remoteSigner.disable();
		enabled = false;
	}

	function copy(): void {
		copyToClipboard(remoteSigner.bunkerUrl);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 3000);
	}
</script>

{#if canEnable || enabled}
	<h3>{$_('remote-signer-service.title')} (experimental)</h3>
	<p>
		{$_('remote-signer-service.description').replace('%s', page.url.host)}
		<br />
		{$_('remote-signer-service.extension')}
	</p>
	{#if enabled}
		{#if canEnable}
			<button onclick={copy} disabled={copied}>
				{$_('remote-signer-service.copy')}{#if copied}<IconCheck size={16} />{/if}
			</button>
		{/if}
		<button onclick={disable}>{$_('remote-signer-service.disable')}</button>
	{:else if canEnable}
		<button onclick={enable}>{$_('remote-signer-service.enable')}</button>
	{/if}
{/if}

<style>
	p {
		margin: 0.5rem 0;
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
</style>
