<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import { nip19 } from 'nostr-tools';
	import type { User } from '../../types';

	let users: User[] = [];

	afterNavigate(async () => {
		const slug = $page.params.npub;
		console.log('[slug]', slug);
		const { type, data } = nip19.decode(slug);
		console.log('[decode]', type, data);
	});
</script>

<h1>Followees</h1>
