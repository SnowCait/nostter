<script lang="ts">
	import { goto } from '$app/navigation';
	import { followees, pubkey, author } from '$lib/stores/Author';
	import { loginResolved } from '$lib/login-state';
	import Notice from '$lib/components/Notice.svelte';
	import SplashScreen from './SplashScreen.svelte';
	import Login from './(app)/Login.svelte';

	let homeLink = $derived(
		$followees.filter((x) => x !== $pubkey).length > 0 ? '/home' : '/public'
	);

	$effect(() => {
		if ($author !== undefined) {
			goto(homeLink);
		}
	});
</script>

<Notice />

{#if !$loginResolved || $pubkey}
	<SplashScreen />
{:else}
	<Login />
{/if}
