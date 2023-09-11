<script lang="ts">
	import { onMount } from 'svelte';
	import IconHome from '@tabler/icons-svelte/dist/svelte/icons/IconHome.svelte';
	import IconSearch from '@tabler/icons-svelte/dist/svelte/icons/IconSearch.svelte';
	import IconWorld from '@tabler/icons-svelte/dist/svelte/icons/IconWorld.svelte';
	import IconBell from '@tabler/icons-svelte/dist/svelte/icons/IconBell.svelte';
	import IconBellRingingFilled from '@tabler/icons-svelte/dist/svelte/icons/IconBellRingingFilled.svelte';
	import IconUser from '@tabler/icons-svelte/dist/svelte/icons/IconUser.svelte';
	import IconSettings from '@tabler/icons-svelte/dist/svelte/icons/IconSettings.svelte';
	import IconBookmark from '@tabler/icons-svelte/dist/svelte/icons/IconBookmark.svelte';
	import { nip19 } from 'nostr-tools';
	import { pubkey } from '../stores/Author';
	import { japaneseBotNpub, trendingPeopleBotNpub } from '$lib/Constants';
	import { unreadEvents } from '../stores/Notifications';

	let npub = trendingPeopleBotNpub;

	onMount(() => {
		if (navigator.language === 'ja-JP') {
			npub = japaneseBotNpub;
		}
	});
</script>

<nav>
	<ul>
		{#if $pubkey}
			<a href="/home">
				<li>
					<IconHome size={30} />
				</li>
			</a>
		{:else}
			<a href="/">
				<li>
					<IconHome size={30} />
				</li>
			</a>
		{/if}
		<a href="/search">
			<li>
				<IconSearch size={30} />
			</li>
		</a>
		<a href="/{npub}/timeline">
			<li>
				<IconWorld size={30} />
			</li>
		</a>
		{#if $pubkey}
			<a href="/notifications">
				<li>
					{#if $unreadEvents.length > 0}
						<IconBellRingingFilled size={30} />
					{:else}
						<IconBell size={30} />
					{/if}
				</li>
			</a>
			<a href="/{nip19.npubEncode($pubkey)}/bookmark">
				<li>
					<IconBookmark size={30} />
				</li>
			</a>
			<a href="/{nip19.npubEncode($pubkey)}">
				<li>
					<IconUser size={30} />
				</li>
			</a>
			<a href="/preference">
				<li>
					<IconSettings size={30} />
				</li>
			</a>
		{/if}
	</ul>
</nav>

<style>
	ul {
		list-style: none;
		padding: 0;
	}

	li {
		width: 50px;
		height: 50px;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	a:visited {
		color: inherit;
	}

	@media screen and (max-width: 600px) {
		ul {
			display: flex;
			flex-flow: row;
			justify-content: space-around;
			margin: 0;
		}
	}
</style>
