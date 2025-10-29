<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { nip19 } from 'nostr-tools';
	import { appName, japaneseBotNpub, trendingPeopleBotNpub } from '$lib/Constants';
	import UserFollowingTimeline from '../[slug=npub]/timeline/UserFollowingTimeline.svelte';

	let pubkey: string | undefined;

	onMount(async () => {
		const npub = navigator.language.startsWith('ja') ? japaneseBotNpub : trendingPeopleBotNpub;
		pubkey = nip19.decode(npub).data as string;
	});
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.global')}</title>
</svelte:head>

<h1>{$_('layout.header.global')}</h1>

<div class="message">{$_('pages.trend.message')}<br />{$_('pages.trend.message2')}</div>

{#if pubkey !== undefined}
	<div class="timeline">
		<UserFollowingTimeline {pubkey} />
	</div>
{/if}

<style>
	@media screen and (min-width: 601px) {
		.timeline {
			margin-top: 0.75rem;
		}
	}

	.message {
		text-align: center;
		margin: 1rem;
	}
</style>
