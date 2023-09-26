<script lang="ts">
	import { _ } from 'svelte-i18n';
	import FollowingTimeline from './FollowingTimeline.svelte';
	import UserFollowingTimeline from '../[npub=npub]/timeline/UserFollowingTimeline.svelte';
	import { japaneseBotNpub } from '$lib/Constants';
	import { nip19 } from 'nostr-tools';

	let pubkey: string;
	$: pubkey = nip19.decode(japaneseBotNpub).data as string;

	let selected: 'home' | 'global' = 'home';
</script>

<select bind:value={selected}>
	<option value="home">{$_('layout.header.home')}</option>
	<option value="global">{$_('layout.header.global')}</option>
</select>

{#if selected === 'home'}
	<FollowingTimeline />
{:else if selected === 'global'}
	<UserFollowingTimeline {pubkey} />
{/if}
