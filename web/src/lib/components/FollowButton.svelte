<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { follow, unfollow } from '$lib/author/Follow';
	import { metadataStore } from '$lib/cache/Events';
	import { alternativeName } from '$lib/Items';
	import { originalFollowees } from '$lib/stores/Author';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let processing = $state(false);

	async function onFollow() {
		console.log('[follow]');

		processing = true;

		try {
			await follow([pubkey]);
		} catch (error) {
			console.error('[follow failed]', error);
			alert('Failed to follow.');
		}

		processing = false;
	}

	async function onUnfollow() {
		console.log('[unfollow]');

		const metadata = $metadataStore.get(pubkey);

		if (!confirm(`Unfollow @${metadata?.displayName ?? alternativeName(pubkey)}?`)) {
			console.log('Unfollow is cancelled');
			return;
		}

		processing = true;

		try {
			await unfollow([pubkey]);
		} catch (error) {
			console.error('[unfollow failed]', error);
			alert('Failed to unfollow.');
		}

		processing = false;
	}
</script>

{#if $originalFollowees.includes(pubkey)}
	<button onclick={onUnfollow} class="button-small button-outlined" disabled={processing}>
		{$_('follow.following')}
	</button>
{:else}
	<button onclick={onFollow} class="button-small" disabled={processing}>
		{$_('follow.follow')}
	</button>
{/if}

<style>
	button {
		display: flex;
		row-gap: 2px;
	}
	:global(button .loader > svg) {
		fill: white;
	}
</style>
