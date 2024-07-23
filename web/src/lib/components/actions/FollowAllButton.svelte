<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { follow } from '$lib/author/Follow';

	export let pubkeys: string[];

	async function onFollowAll(): Promise<void> {
		console.log('[follow all]');

		if (!confirm($_('actions.follow.all.confirm').replace('%d', `${pubkeys.length}`))) {
			return;
		}

		await follow(pubkeys);
	}
</script>

<button on:click={onFollowAll}>{$_('actions.follow.all.button')}</button>
