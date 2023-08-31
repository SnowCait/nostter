<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { userStatusesGeneral, userStatusesMusic } from '../../stores/UserStatuses';
	import IconUser from '@tabler/icons-svelte/dist/svelte/icons/IconUser.svelte';
	import IconMusic from '@tabler/icons-svelte/dist/svelte/icons/IconMusic.svelte';

	export let pubkey: string;
	let generalEvent: Event | undefined;
	let musicEvent: Event | undefined;
	$: {
		$userStatusesGeneral.sort((x, y) => x.created_at - y.created_at);
		$userStatusesMusic.sort((x, y) => x.created_at - y.created_at);
		generalEvent = $userStatusesGeneral.findLast((event) => event.pubkey === pubkey);
		musicEvent = $userStatusesMusic.findLast((event) => event.pubkey === pubkey);
	}
</script>

<section>
	{#if generalEvent !== undefined && generalEvent.content !== ''}
		<div><IconUser size={14} />{generalEvent.content}</div>
	{/if}
	{#if musicEvent !== undefined && musicEvent.content !== ''}
		<div><IconMusic size={14} />{musicEvent.content}</div>
	{/if}
</section>

<style>
	section {
		/* Workaround for unnecessary space */
		display: flex;
		flex-direction: column;
	}

	div {
		color: gray;
		font-size: 0.7rem;
	}
</style>
