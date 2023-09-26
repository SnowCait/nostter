<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { User } from '$lib/User';
	import UserFollowingTimeline from './UserFollowingTimeline.svelte';

	let pubkey: string;

	afterNavigate(async () => {
		const slug = $page.params.npub;
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
	});
</script>

<UserFollowingTimeline {pubkey} />
