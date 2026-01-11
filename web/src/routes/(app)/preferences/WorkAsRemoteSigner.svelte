<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { remoteSigner } from '$lib/RemoteSigner';
	import { copy as copyToClipboard } from '$lib/Clipboard';
	import { IconCheck } from '@tabler/icons-svelte';
	import { page } from '$app/state';

	let enabled = $state(remoteSigner.enabled);
	let copied = $state(false);

	function enable(): void {
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

<h3>{$_('remote-signer-service.title')} (experimental)</h3>
<p>
	{$_('remote-signer-service.description').replace('%s', page.url.host)}
	<br />
	{$_('remote-signer-service.extension')}
</p>
{#if enabled}
	<button onclick={copy} disabled={copied}>
		{$_('remote-signer-service.copy')}{#if copied}<IconCheck size={16} />{/if}
	</button>
	<button onclick={disable}>{$_('remote-signer-service.disable')}</button>
{:else}
	<button onclick={enable}>{$_('remote-signer-service.enable')}</button>
{/if}

<style>
	p {
		margin: 0.5rem 0;
	}
</style>
