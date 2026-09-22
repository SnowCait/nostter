<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { follow } from '$lib/author/Follow';
	import { auth } from '$lib/auth.svelte';
	import type { Signer } from '$lib/nostr/signing/signer';

	interface Props {
		pubkeys: string[];
	}

	let { pubkeys }: Props = $props();

	async function signEvent(template: Parameters<Signer['signEvent']>[0]) {
		const signer = auth.signer;
		if (signer === undefined) {
			throw new Error('Cannot sign an event without a signing session');
		}

		return signer.signEvent(template);
	}

	async function onFollowAll(): Promise<void> {
		console.log('[follow all]');

		if (!confirm($_('actions.follow.all.confirm').replace('%d', `${pubkeys.length}`))) {
			return;
		}

		await follow(signEvent, pubkeys);
	}
</script>

<button onclick={onFollowAll}>{$_('actions.follow.all.button')}</button>
