<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface Props {
		query: string;
		scope?: string;
	}

	let { query, scope = 'nostr' }: Props = $props();
</script>

<form action="/search">
	<input type="search" name="q" value={query} />
	<input type="submit" value={$_('search.search')} />

	<details>
		<summary>{$_('search.options')}</summary>

		<div>
			<select name="scope" bind:value={scope}>
				<option value="all">{$_('search.scope.all')}</option>
				<option value="nostr">{$_('search.scope.nostr')}</option>
				<!-- <option value="following">{$_('search.scope.following')}</option> -->
				<option value="mine">{$_('search.scope.mine')}</option>
			</select>
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
