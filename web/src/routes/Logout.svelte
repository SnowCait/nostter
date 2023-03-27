<script lang="ts">
	import { goto } from '$app/navigation';

	async function logout() {
		localStorage.clear();
		await goto('/');
	}
</script>

<button on:click={logout}>Logout</button>
