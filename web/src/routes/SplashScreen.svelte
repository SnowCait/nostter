<script>
	import NostterLogo from './(app)/parts/NostterLogo.svelte';
</script>

<main>
	<div>
		<NostterLogo width="100%" />
	</div>
</main>

<style>
	:global(html, body) {
		width: 100vw;
		height: 100vh;
	}

	main {
		height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	main > div {
		width: 90vw;
		max-width: 360px;
	}
</style>
