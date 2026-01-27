<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface Props {
		query: string;
		mine?: boolean;
		proxy?: boolean;
	}

	let { query, mine = false, proxy = false }: Props = $props();
</script>

<form action="/search">
	<input type="search" name="q" value={query} />
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
