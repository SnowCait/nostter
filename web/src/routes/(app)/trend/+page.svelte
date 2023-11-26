<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { appName, japaneseBotNpub } from '$lib/Constants';
	import HomeTab from '$lib/components/HomeTab.svelte';
	import UserFollowingTimeline from '../[slug=npub]/timeline/UserFollowingTimeline.svelte';

	const pubkey = nip19.decode(japaneseBotNpub).data as string;
	let userFollowingTimeline: UserFollowingTimeline | undefined;

	onMount(async () => {
		await userFollowingTimeline?.initialize();
	});
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.global')}</title>
</svelte:head>

<HomeTab selected="trend" />

<UserFollowingTimeline {pubkey} bind:this={userFollowingTimeline} />
