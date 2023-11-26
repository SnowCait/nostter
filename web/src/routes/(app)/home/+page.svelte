<script lang="ts">
	import { _ } from 'svelte-i18n';
	import FollowingTimeline from './FollowingTimeline.svelte';
	import { appName } from '$lib/Constants';
	import HomeTab from '$lib/components/HomeTab.svelte';
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.home')}</title>
</svelte:head>

<HomeTab selected="home" />

<FollowingTimeline />
