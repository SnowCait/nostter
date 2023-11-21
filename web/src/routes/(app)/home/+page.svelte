<script lang="ts">
	import { _ } from 'svelte-i18n';
	import FollowingTimeline from './FollowingTimeline.svelte';
	import UserFollowingTimeline from '../[slug=npub]/timeline/UserFollowingTimeline.svelte';
	import { appName, japaneseBotNpub } from '$lib/Constants';
	import { nip19 } from 'nostr-tools';
	import { tick } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import { pubkey as authorPubkey, followees } from '../../../stores/Author';

	let pubkey: string;
	$: pubkey = nip19.decode(japaneseBotNpub).data as string;

	let selected: Writable<'home' | 'global'> = writable(
		$followees.filter((x) => x !== $authorPubkey).length > 0 ? 'home' : 'global'
	);
	let userFollowingTimeline: UserFollowingTimeline | undefined;

	selected.subscribe(async (value) => {
		console.log('[home selected]', value);
		if (value === 'global') {
			await tick();
			await userFollowingTimeline?.initialize();
		}
	});
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.home')}</title>
</svelte:head>

<select bind:value={$selected}>
	<option value="home">{$_('layout.header.home')}</option>
	<option value="global">{$_('layout.header.global')}</option>
</select>

{#if $selected === 'home'}
	<FollowingTimeline />
{:else if $selected === 'global'}
	<UserFollowingTimeline {pubkey} bind:this={userFollowingTimeline} />
{/if}

<style>
	select {
		border: none;
		font-size: 2rem;
		font-weight: bold;
		outline: none;
		background: none;
		color: var(--foreground);
	}
</style>
