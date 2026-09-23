<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import { gotoAfterLogin } from '$lib/post-login-navigation';
	import Notice from '$lib/components/Notice.svelte';
	import SplashScreen from './SplashScreen.svelte';
	import Login from './(app)/Login.svelte';

	$effect(() => {
		if (auth.isAuthenticated) {
			gotoAfterLogin();
		}
	});
</script>

<Notice />

{#if auth.isInitializing || auth.isAuthenticated}
	<SplashScreen />
{:else}
	<Login />
{/if}
