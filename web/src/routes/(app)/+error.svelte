<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<main>
	<h1>{$_('error.title')}</h1>
	<p>{$_('error.message')}</p>
</main>

<style>
	main {
		margin: 5rem auto;
		text-align: center;
	}

	h1 {
		margin: 1rem auto;
	}
</style>
