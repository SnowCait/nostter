<script lang="ts">
	async function logout() {
		localStorage.clear();
		location.href = '/';
	}
</script>

<button on:click={logout}>Logout</button>
