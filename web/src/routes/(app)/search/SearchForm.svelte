<script lang="ts">
	import { unique } from '$lib/Array';
	import { parseSearchQuery } from '$lib/Search';
	import { developerMode } from '$lib/stores/Preference';
	import type { Filter } from 'nostr-tools/filter';
	import { ShortTextNote } from 'nostr-tools/kinds';
	import { _ } from 'svelte-i18n';

	interface Props {
		query: string;
		scope?: string;
	}

	let { query, scope = 'nostr' }: Props = $props();

	let filter = $derived.by(() => {
		const { keyword, kinds, fromPubkeys, toPubkeys, hashtags, since, until } = parseSearchQuery(
			query,
			scope === 'mine'
		);
		if (
			keyword.length === 0 &&
			kinds.length === 0 &&
			fromPubkeys.length === 0 &&
			toPubkeys.length === 0 &&
			hashtags.length === 0 &&
			since === undefined &&
			until === undefined
		) {
			return undefined;
		}
		return {
			search: keyword.length > 0 ? keyword : undefined,
			kinds: kinds.length > 0 ? kinds : [ShortTextNote],
			authors: fromPubkeys.length > 0 ? fromPubkeys : undefined,
			'#p': toPubkeys.length > 0 ? toPubkeys : undefined,
			'#t':
				hashtags.length > 0
					? unique([...hashtags, ...hashtags.map((hashtag) => hashtag.toLowerCase())])
					: undefined,
			since,
			until
		} satisfies Filter;
	});
</script>

<form action="/search" class="card">
	<div class="search-row">
		<input type="search" name="q" bind:value={query} />
		<input type="submit" value={$_('search.search')} />
	</div>

	<details class="search-options">
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

	{#if $developerMode}
		<hr class="dev-divider" />
		<details class="dev-filter">
			<summary>Generated REQ Filter</summary>
			<code>{JSON.stringify(filter, null, 2)}</code>
		</details>
	{/if}
</form>

<style>
	.search-row {
		display: flex;
		gap: 0.5rem;
	}

	.search-row input[type='search'] {
		flex: 1;
	}

	.search-row input[type='submit'] {
		flex-shrink: 0;
	}

	details.search-options {
		margin-top: 0.75rem;
	}

	details.search-options summary {
		cursor: pointer;
		color: var(--accent);
		font-size: 0.9rem;
		user-select: none;
	}

	details.search-options div {
		margin: 0.5rem 0 0;
	}

	hr.dev-divider {
		margin: 0.75rem 0;
		border: none;
		border-top: var(--default-border);
	}

	details.dev-filter summary {
		cursor: pointer;
		font-size: 0.8rem;
		font-family: monospace;
		color: var(--accent);
		user-select: none;
	}

	details.dev-filter code {
		margin-top: 0.5rem;
	}

	@media screen and (max-width: 600px) {
		.search-row {
			flex-direction: column;
		}
	}
</style>
