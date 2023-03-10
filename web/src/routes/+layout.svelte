<script lang="ts">
	import Header from './Header.svelte';
	import NoteDialog from './NoteDialog.svelte';
</script>

<div class="app">
	<NoteDialog />

	<header>
		<Header />
	</header>

	<main>
		<slot />
	</main>
</div>

<style>
	.app {
		max-width: 800px;
		margin: 0 auto;
	}

	header {
		position: fixed;
		top: 0;
		width: 50px;
	}

	main {
		margin-left: 60px;
	}
</style>
