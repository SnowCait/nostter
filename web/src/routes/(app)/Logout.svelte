<script lang="ts">
	import { WebStorage } from '$lib/WebStorage';
	import { loginType } from '../../stores/Author';

	let saved = false;
	let showNsec = false;

	async function logout() {
		new WebStorage(localStorage).clear();
		location.href = '/';
	}
</script>

{#if $loginType === 'nsec'}
	<h4>Ensure to save nsec before logout</h4>
	<div>
		<span>nsec:</span>
		<input
			type={showNsec ? 'text' : 'password'}
			value={new WebStorage(localStorage).get('login')}
			readonly
		/>
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
