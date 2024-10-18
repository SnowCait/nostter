<script lang="ts">
	import { _ } from 'svelte-i18n';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import SystemMessage from '../SystemMessage.svelte';
	import OnelineProfile from '../profile/OnelineProfile.svelte';
	import type { Event } from 'nostr-typedef';
	import CreatedAt from '../CreatedAt.svelte';

	export let event: Event;

	$: link = new URL(`https://nostrapp.link/kind/${event.kind}`);
</script>

<SystemMessage>
	<div class="title">
		<h2>Direct Message</h2>
		<div class="created-at"><CreatedAt createdAt={event.created_at} /></div>
	</div>
	<div>from <OnelineProfile pubkey={event.pubkey} /></div>
	<p>
		<ExternalLink {link}>
			{$_('actions.open_in_other_apps.button')}
		</ExternalLink>
	</p>
</SystemMessage>

<style>
	.title {
		display: flex;
		justify-content: space-between;
	}

	p {
		margin-top: 0.5rem;
	}
</style>
