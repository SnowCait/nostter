<script lang="ts">
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import IconCheck from '@tabler/icons-svelte/dist/svelte/icons/IconCheck.svelte';

	let uri = browser ? new WebStorage(localStorage).get('nostr-wallet-connect') ?? '' : '';
	let valid = true;
	let saved = false;

	function save(): void {
		valid = uri === '' || /^nostr\+walletconnect:\/*[0-9a-f]{64}\?.+$/.test(uri);

		try {
			if (valid && uri !== '') {
				const { searchParams } = new URL(uri);
				valid = searchParams.has('relay') && searchParams.has('secret');
			}
		} catch (error) {
			valid = false;
		}

		if (!valid) {
			console.warn('[invalid NWC URI]');
			return;
		}

		const storage = new WebStorage(localStorage);
		storage.set('nostr-wallet-connect', uri);
		saved = true;
	}
</script>

<h3>Nostr Wallet Connect</h3>

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
	.invalid {
		border-color: var(--red);
	}

	.check {
		color: var(--green);
	}
</style>
