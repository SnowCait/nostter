<script lang="ts">
	import { _ } from 'svelte-i18n';

	export let query: string;
	export let mine: boolean = false;
</script>

<form action="/search">
	<input type="search" name="q" value={query} on:keyup|stopPropagation={() => console.debug} />
	<input type="submit" value={$_('search.search')} />
	<details>
		<summary>{$_('search.options')}</summary>

		<label>
			<input type="checkbox" name="mine" checked={mine} />
			<span>{$_('search.mine')}</span>
		</label>
	</details>
</form>

<style>
	details {
		margin-top: 1rem;
	}

	summary {
		margin-bottom: 0.75rem;
	}
</style>
