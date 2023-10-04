<script lang="ts">
	import { onMount } from 'svelte';
	import { WebStorage } from '$lib/WebStorage';
	import { loginType } from '../stores/Author';

	let saved = false;
	let showNsec = false;
	let storage: WebStorage;

	onMount(() => {
		storage = new WebStorage(localStorage);
	});

	async function logout() {
		storage.clear();
		location.href = '/';
	}
</script>

{#if $loginType === 'nsec'}
	<h4>Ensure to save nsec before logout</h4>
	<div>
		<span>nsec:</span>
		<input type={showNsec ? 'text' : 'password'} value={storage.get('login')} readonly />
		<button on:click={() => (showNsec = !showNsec)}>Show</button>
	</div>
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
