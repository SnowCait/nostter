<script lang="ts">
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { parseConnectionString } from '$lib/nostr-tools/nip47';
	import IconCheck from '@tabler/icons-svelte/dist/svelte/icons/IconCheck.svelte';

	let uri = browser ? new WebStorage(localStorage).get('nostr-wallet-connect') ?? '' : '';
	let valid = true;
	let saved = false;

	function save(): void {
		if (!isValid(uri)) {
			console.warn('[invalid NWC URI]');
			return;
		}

		const storage = new WebStorage(localStorage);
		storage.set('nostr-wallet-connect', uri);
		saved = true;
	}

	function isValid(uri: string): boolean {
		if (uri === '') {
			return true;
		}

		if (!/^nostr\+walletconnect:\/*[0-9a-f]{64}\?.+$/.test(uri)) {
			return false;
		}

		try {
			parseConnectionString(uri);
			return true;
		} catch (error) {
			return false;
		}
	}
</script>

<h3>Nostr Wallet Connect</h3>

<p>
	Generate with <ExternalLink link={new URL('https://nwc.getalby.com/')}>Alby</ExternalLink>, <ExternalLink
		link={new URL('https://app.mutinywallet.com/')}>Munity</ExternalLink
	> or other wallet.
</p>

<input
	type="url"
	placeholder="nostr+walletconnect:"
	bind:value={uri}
	on:keyup|stopPropagation
	on:change={save}
	class:invalid={!valid}
/>

{#if valid && saved}
	<span class="check">
		<IconCheck />
	</span>
{/if}

<style>
	p {
		margin: 0.5rem auto;
	}

	input {
		width: 100%;
	}

	.invalid {
		border-color: var(--red);
	}

	.check {
		color: var(--green);
	}
</style>
