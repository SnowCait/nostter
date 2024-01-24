<script lang="ts">
	import { _ } from 'svelte-i18n';

	export let query: string;
	export let mine = false;
	export let proxy = false;
</script>

<form action="/search">
	<input type="search" name="q" value={query} on:keyup|stopPropagation={() => console.debug} />
	<input type="submit" value={$_('search.search')} />
	<details>
		<summary>{$_('search.options')}</summary>

		<div>
			<label>
				<input type="checkbox" name="mine" checked={mine} />
				<span>{$_('search.mine')}</span>
			</label>
		</div>

		<div>
			<label>
				<input type="checkbox" name="proxy" checked={proxy} />
				<span>{$_('search.proxy')}</span>
			</label>
		</div>
	</details>
</form>

<style>
	details {
		margin-top: 1rem;
	}

	div {
		margin: 0.75rem auto;
	}
</style>
