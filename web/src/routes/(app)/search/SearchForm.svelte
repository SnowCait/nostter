<script lang="ts">
	import { unique } from '$lib/Array';
	import {
		buildSearchQuery,
		decodeToPubkey,
		extractDateInputs,
		parseSearchQuery
	} from '$lib/Search';
	import { developerMode } from '$lib/stores/Preference';
	import { createTagsInput, melt, type Tag } from '@melt-ui/svelte';
	import { nip19, type Filter } from 'nostr-tools';
	import {
		ChannelMessage,
		LongFormArticle,
		Poll,
		Reaction,
		Repost,
		ShortTextNote
	} from 'nostr-tools/kinds';
	import { writable } from 'svelte/store';
	import { _ } from 'svelte-i18n';

	interface Props {
		query: string;
		scope?: string;
	}

	let { query, scope = 'nostr' }: Props = $props();

	const kindPresets = [
		{ kind: ShortTextNote, label: () => $_('search.kindPresets.notes') },
		{ kind: Repost, label: () => $_('search.kindPresets.reposts') },
		{ kind: Reaction, label: () => $_('search.kindPresets.reactions') },
		{ kind: ChannelMessage, label: () => $_('search.kindPresets.channelMessage') },
		{ kind: LongFormArticle, label: () => $_('search.kindPresets.article') },
		{ kind: Poll, label: () => $_('search.kindPresets.poll') }
	];
	const presetKinds = kindPresets.map((preset) => preset.kind);

	// Tags Input external stores (id = hex pubkey / kind number, value = display).
	const fromTags = writable<Tag[]>([]);
	const toTags = writable<Tag[]>([]);
	const customKindTags = writable<Tag[]>([]);

	// Accept both npub and nprofile, store the hex pubkey, display the canonical npub.
	const pubkeyAdd = (input: string): Tag => {
		const pubkey = decodeToPubkey(input.trim());
		if (pubkey === undefined) {
			throw new Error('invalid npub/nprofile');
		}
		return { id: pubkey, value: nip19.npubEncode(pubkey) };
	};
	const kindAdd = (input: string): Tag => {
		const kind = Number(input.trim());
		if (!Number.isInteger(kind) || kind < 0 || presetKinds.includes(kind)) {
			throw new Error('invalid kind');
		}
		return { id: String(kind), value: String(kind) };
	};

	const {
		elements: { root: fromRoot, input: fromInput, tag: fromTag, deleteTrigger: fromDelete }
	} = createTagsInput({ tags: fromTags, unique: true, editable: false, add: pubkeyAdd });
	const {
		elements: { root: toRoot, input: toInput, tag: toTag, deleteTrigger: toDelete }
	} = createTagsInput({ tags: toTags, unique: true, editable: false, add: pubkeyAdd });
	const {
		elements: { root: kindRoot, input: kindInput, tag: kindTag, deleteTrigger: kindDelete }
	} = createTagsInput({ tags: customKindTags, unique: true, editable: false, add: kindAdd });

	let selectedPresets = $state<Record<number, boolean>>({});
	let sinceDate = $state('');
	let untilDate = $state('');
	let keyword = $state('');

	// Re-sync all fields whenever the incoming query changes (initial mount + navigation).
	$effect(() => {
		applyQuery(query);
	});

	function applyQuery(rawQuery: string): void {
		const {
			fromPubkeys,
			toPubkeys,
			hashtags,
			kinds,
			keyword: parsedKeyword
		} = parseSearchQuery(rawQuery);
		const { sinceDate: since, untilDate: until } = extractDateInputs(rawQuery);

		fromTags.set(fromPubkeys.map((hex) => ({ id: hex, value: nip19.npubEncode(hex) })));
		toTags.set(toPubkeys.map((hex) => ({ id: hex, value: nip19.npubEncode(hex) })));

		// Default to kind 1 (Notes) when no kind is specified, matching the search page.
		const effectiveKinds = kinds.length === 0 ? [ShortTextNote] : kinds;
		const presets: Record<number, boolean> = {};
		for (const kind of effectiveKinds) {
			if (presetKinds.includes(kind)) {
				presets[kind] = true;
			}
		}
		selectedPresets = presets;
		customKindTags.set(
			unique(effectiveKinds.filter((kind) => !presetKinds.includes(kind))).map((kind) => ({
				id: String(kind),
				value: String(kind)
			}))
		);

		sinceDate = since ?? '';
		untilDate = until ?? '';
		// Keep hashtags inline in the keyword field (hashtags have no dedicated UI).
		keyword = [parsedKeyword, ...hashtags.map((hashtag) => `#${hashtag}`)].join(' ').trim();
	}

	let kinds = $derived(
		unique([
			...presetKinds.filter((kind) => selectedPresets[kind]),
			...$customKindTags.map((tag) => Number(tag.value))
		])
	);

	let q = $derived(
		buildSearchQuery({
			kinds,
			fromPubkeys: $fromTags.map((tag) => tag.id),
			toPubkeys: $toTags.map((tag) => tag.id),
			sinceDate: sinceDate || undefined,
			untilDate: untilDate || undefined,
			keyword
		})
	);

	let filter = $derived.by(() => {
		const {
			keyword: parsedKeyword,
			kinds: parsedKinds,
			fromPubkeys,
			toPubkeys,
			hashtags,
			since,
			until
		} = parseSearchQuery(q, scope === 'mine');
		if (
			parsedKeyword.length === 0 &&
			parsedKinds.length === 0 &&
			fromPubkeys.length === 0 &&
			toPubkeys.length === 0 &&
			hashtags.length === 0 &&
			since === undefined &&
			until === undefined
		) {
			return undefined;
		}
		return {
			search: parsedKeyword.length > 0 ? parsedKeyword : undefined,
			kinds: parsedKinds.length > 0 ? parsedKinds : [ShortTextNote],
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

	function shortNpub(npub: string): string {
		return npub.length > 16 ? `${npub.slice(0, 10)}…${npub.slice(-4)}` : npub;
	}
</script>

<form action="/search" class="card">
	<div class="search-row">
		<input type="search" bind:value={keyword} placeholder={$_('search.search')} />
		<input type="submit" value={$_('search.search')} />
	</div>

	<!-- Composed from the UI fields below; the keyword above is appended as-is. -->
	<input type="hidden" name="q" value={q} />

	<details class="search-options">
		<summary>{$_('search.options')}</summary>

		<div class="field">
			<span class="label">{$_('search.fields.kinds')}</span>
			<div class="presets">
				{#each kindPresets as preset (preset.kind)}
					<label class="preset">
						<input type="checkbox" bind:checked={selectedPresets[preset.kind]} />
						{preset.label()}
					</label>
				{/each}
			</div>
			<div use:melt={$kindRoot} class="tags-input">
				{#each $customKindTags as tag (tag.id)}
					<div use:melt={$kindTag(tag)} class="tag">
						{tag.value}
						<button type="button" use:melt={$kindDelete(tag)} class="delete">×</button>
					</div>
				{/each}
				<input
					use:melt={$kindInput}
					type="text"
					inputmode="numeric"
					placeholder={$_('search.fields.kindsCustom')}
				/>
			</div>
		</div>

		<div class="date-row">
			<label class="field">
				<span class="label">{$_('search.fields.since')}</span>
				<input type="date" bind:value={sinceDate} />
			</label>
			<label class="field">
				<span class="label">{$_('search.fields.until')}</span>
				<input type="date" bind:value={untilDate} />
			</label>
		</div>

		<div class="field">
			<span class="label">{$_('search.fields.from')}</span>
			<div use:melt={$fromRoot} class="tags-input">
				{#each $fromTags as tag (tag.id)}
					<div use:melt={$fromTag(tag)} class="tag">
						{shortNpub(tag.value)}
						<button type="button" use:melt={$fromDelete(tag)} class="delete">×</button>
					</div>
				{/each}
				<input use:melt={$fromInput} type="text" placeholder="npub / nprofile" />
			</div>
		</div>

		<div class="field">
			<span class="label">{$_('search.fields.to')}</span>
			<div use:melt={$toRoot} class="tags-input">
				{#each $toTags as tag (tag.id)}
					<div use:melt={$toTag(tag)} class="tag">
						{shortNpub(tag.value)}
						<button type="button" use:melt={$toDelete(tag)} class="delete">×</button>
					</div>
				{/each}
				<input use:melt={$toInput} type="text" placeholder="npub / nprofile" />
			</div>
		</div>

		<div class="field">
			<span class="label">{$_('search.scope.label')}</span>
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

	.field {
		display: block;
		margin: 0.75rem 0 0;
	}

	.field .label {
		display: block;
		font-size: 0.85rem;
		color: var(--accent);
		margin-bottom: 0.25rem;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.preset {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.date-row {
		display: flex;
		gap: 0.75rem;
	}

	.date-row .field {
		flex: 1;
	}

	.tags-input {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		padding: 0.25rem;
		border: var(--default-border);
		border-radius: var(--radius, 4px);
	}

	.tags-input input {
		flex: 1;
		min-width: 8rem;
		border: none;
		outline: none;
		background: transparent;
		padding: 0.2rem;
	}

	.tag {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1rem 0.4rem;
		background: var(--accent-surface, rgba(127, 127, 127, 0.15));
		border-radius: 9999px;
		font-size: 0.85rem;
	}

	.tag .delete {
		border: none;
		background: transparent;
		cursor: pointer;
		color: inherit;
		font-size: 1rem;
		line-height: 1;
		padding: 0;
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
