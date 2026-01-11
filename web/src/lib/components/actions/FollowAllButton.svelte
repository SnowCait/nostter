<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { follow } from '$lib/author/Follow';

	interface Props {
		pubkeys: string[];
	}

	let { pubkeys }: Props = $props();

	async function onFollowAll(): Promise<void> {
		console.log('[follow all]');

		if (!confirm($_('actions.follow.all.confirm').replace('%d', `${pubkeys.length}`))) {
			return;
		}

		await follow(pubkeys);
	}
</script>

<button onclick={onFollowAll}>{$_('actions.follow.all.button')}</button>
