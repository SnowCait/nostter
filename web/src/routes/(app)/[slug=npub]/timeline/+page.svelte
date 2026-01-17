<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { appName } from '$lib/Constants';
	import { User } from '$lib/User';
	import UserFollowingTimeline from './UserFollowingTimeline.svelte';
	import { page } from '$app/state';

	let pubkey = $state<string>();

	afterNavigate(async () => {
		const slug = page.params.slug!;
		console.debug('[timeline page]', slug);

		const data = await User.decode(slug);
		console.debug('[data]', data);

		if (data.pubkey === undefined) {
			error(404);
		}

		if (pubkey === data.pubkey) {
			return;
		}

		pubkey = data.pubkey;
	});
</script>

<svelte:head>
	<title>{appName} - {$_('pages.timeline')}</title>
</svelte:head>

{#if pubkey !== undefined}
	<UserFollowingTimeline {pubkey} />
{/if}
