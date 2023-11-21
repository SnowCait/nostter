<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { appName } from '$lib/Constants';
	import { User } from '$lib/User';
	import UserFollowingTimeline from './UserFollowingTimeline.svelte';

	let pubkey: string;
	let timeline: UserFollowingTimeline;

	afterNavigate(async () => {
		const slug = $page.params.slug;
		console.log('[timeline page]', slug);

		const data = await User.decode(slug);
		console.log('[data]', data);

		if (data.pubkey === undefined) {
			throw error(404);
		}

		if (pubkey === data.pubkey) {
			return;
		}

		pubkey = data.pubkey;

		await timeline.initialize();
	});
</script>

<svelte:head>
	<title>{appName} - {$_('pages.timeline')}</title>
</svelte:head>

<UserFollowingTimeline {pubkey} bind:this={timeline} />
