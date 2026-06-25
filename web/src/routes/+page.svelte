<script lang="ts">
	import { isAuthenticated, isInitializing } from '$lib/auth.svelte';
	import { gotoAfterLogin } from '$lib/post-login-navigation';
	import Notice from '$lib/components/Notice.svelte';
	import SplashScreen from './SplashScreen.svelte';
	import Login from './(app)/Login.svelte';

	$effect(() => {
		if ($isAuthenticated) {
			gotoAfterLogin();
		}
	});
</script>

<Notice />

{#if $isInitializing || $isAuthenticated}
	<SplashScreen />
{:else}
	<Login />
{/if}
