<script lang="ts">
	import { WebStorage } from '$lib/WebStorage';
	import { loginType } from '../stores/Author';

	let saved = false;
	const storage = new WebStorage(localStorage);

	async function logout() {
		storage.clear();
		location.href = '/';
	}
</script>

{#if $loginType === 'nsec'}
	<h4>Ensure to save nsec before logout</h4>
	<div>{storage.get('login')}</div>
{/if}

<button on:click={logout} disabled={$loginType === 'nsec' && !saved}>Logout</button>
{#if $loginType === 'nsec'}
	<label>
		<input type="checkbox" bind:checked={saved} />
		<span>Saved</span>
	</label>
{/if}

<style>
	h4 {
		margin: 0.5rem auto;
	}
	button {
		margin: 1rem auto;
	}
</style>
