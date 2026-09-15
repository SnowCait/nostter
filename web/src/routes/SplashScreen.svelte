<script>
	import NostterLogo from '$lib/components/logo/NostterLogo.svelte';
</script>

<main>
	<div>
		<NostterLogo />
	</div>
</main>

<style>
	main {
		min-height: 100dvh;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	main > div {
		width: 90vw;
		max-width: 360px;
	}
</style>
