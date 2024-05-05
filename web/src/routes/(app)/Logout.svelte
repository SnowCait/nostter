<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { WebStorage } from '$lib/WebStorage';
	import { loginType } from '$lib/stores/Author';

	let saved = false;
	let showNsec = false;

	async function logout() {
		new WebStorage(localStorage).clear();
		location.href = '/';
	}
</script>

{#if $loginType === 'nsec'}
	<h4>{$_('logout.ensure')}</h4>
	<div>
		<span>{$_('logout.private_key')}:</span>
		<input
			type={showNsec ? 'text' : 'password'}
			value={new WebStorage(localStorage).get('login')}
			readonly
		/>
		<button on:click={() => (showNsec = !showNsec)}>{$_('logout.show')}</button>
	</div>
{/if}

<button on:click={logout} disabled={$loginType === 'nsec' && !saved}>{$_('logout.logout')}</button>
{#if $loginType === 'nsec'}
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
