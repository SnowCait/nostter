<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { appName, japaneseBotNpub, trendingPeopleBotNpub } from '$lib/Constants';
	import HomeTab from '$lib/components/HomeTab.svelte';
	import UserFollowingTimeline from '../[slug=npub]/timeline/UserFollowingTimeline.svelte';

	let userFollowingTimeline: UserFollowingTimeline | undefined;

	onMount(async () => {
		const npub = navigator.language.startsWith('ja') ? japaneseBotNpub : trendingPeopleBotNpub;
		const pubkey = nip19.decode(npub).data as string;
		await userFollowingTimeline?.initialize(pubkey);
	});
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.global')}</title>
</svelte:head>

<HomeTab selected="trend" />

<UserFollowingTimeline bind:this={userFollowingTimeline} />
