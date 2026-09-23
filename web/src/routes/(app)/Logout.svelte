<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { logout as logoutSession } from '$lib/Login';
	import { WebStorage } from '$lib/WebStorage';
	import { auth } from '$lib/auth.svelte';

	let saved = $state(false);
	let showNsec = $state(false);

	async function logout() {
		await logoutSession();
	}
</script>

{#if auth.loginMethod === 'nsec'}
	<h4>{$_('logout.ensure')}</h4>
	<div>
		<span>{$_('logout.private_key')}:</span>
		<input
			type={showNsec ? 'text' : 'password'}
			value={new WebStorage(localStorage).get('login')}
			readonly
		/>
		<button onclick={() => (showNsec = !showNsec)}>{$_('logout.show')}</button>
	</div>
{/if}

<button onclick={logout} disabled={auth.loginMethod === 'nsec' && !saved}
	>{$_('logout.logout')}</button
>
{#if auth.loginMethod === 'nsec'}
	<label>
		<input type="checkbox" bind:checked={saved} />
		<span>{$_('logout.saved')}</span>
	</label>
{/if}

<style>
	h4 {
		margin: 0.5rem auto;
	}
</style>
