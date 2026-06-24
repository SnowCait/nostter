<script lang="ts">
	import { unique } from '$lib/Array';
	import {
		buildSearchQuery,
		decodeToPubkey,
		extractDateInputs,
		parseSearchQuery
	} from '$lib/Search';
	import { alternativeName } from '$lib/Items';
	import { developerMode } from '$lib/stores/Preference';
	import { createTagsInput, melt, type Tag } from '@melt-ui/svelte';
	import { Combobox } from 'melt/builders';
	import { nip19, type Filter } from 'nostr-tools';
	import { ChannelMessage, LongFormArticle, Poll, ShortTextNote } from 'nostr-tools/kinds';
	import { writable } from 'svelte/store';
	import { _ } from 'svelte-i18n';
	import { persistedStore } from '$lib/persisted-store';
	import { pushSearchHistory, rankSearchHistory } from '$lib/SearchHistory';
	import { IconX, IconTrash } from '@tabler/icons-svelte-runes';

	interface Props {
		query: string;
		scope?: string;
	}

	let { query, scope = 'nostr' }: Props = $props();

	const kindPresets = [
		{ kind: ShortTextNote, label: () => $_('search.kindPresets.notes') },
		{ kind: ChannelMessage, label: () => $_('search.kindPresets.channelMessage') },
		{ kind: LongFormArticle, label: () => $_('search.kindPresets.article') },
		{ kind: Poll, label: () => $_('search.kindPresets.poll') }
	];
	const presetKinds = kindPresets.map((preset) => preset.kind);

	const fromTags = writable<Tag[]>([]);
	const toTags = writable<Tag[]>([]);
	const customKindTags = writable<Tag[]>([]);

	const pubkeyAdd = (input: string): Tag => {
		const pubkey = decodeToPubkey(input.trim());
		if (pubkey === undefined) {
			throw new Error('invalid npub/nprofile');
		}
		return { id: pubkey, value: nip19.npubEncode(pubkey) };
	};
	const kindAdd = (input: string): Tag => {
		const kind = Number(input.trim());
		if (!Number.isInteger(kind) || kind < 0) {
			throw new Error('invalid kind');
		}
		return { id: String(kind), value: String(kind) };
	};

	const {
		elements: { root: fromRoot, input: fromInput, tag: fromTag, deleteTrigger: fromDelete }
	} = createTagsInput({
		tags: fromTags,
		unique: true,
		editable: false,
		addOnPaste: true,
		blur: 'add',
		add: pubkeyAdd
	});
	const {
		elements: { root: toRoot, input: toInput, tag: toTag, deleteTrigger: toDelete }
	} = createTagsInput({
		tags: toTags,
		unique: true,
		editable: false,
		addOnPaste: true,
		blur: 'add',
		add: pubkeyAdd
	});
	const {
		elements: { root: kindRoot, input: kindInput, tag: kindTag, deleteTrigger: kindDelete }
	} = createTagsInput({
		tags: customKindTags,
		unique: true,
		editable: false,
		addOnPaste: true,
		blur: 'add',
		add: kindAdd
	});

	const searchHistory = persistedStore<string[]>('search:history', []);
	const combobox = new Combobox<string>();

	let selectedPresets = $state<Record<number, boolean>>({});
	let sinceDate = $state('');
	let untilDate = $state('');
	let keyword = $derived(combobox.inputValue);

	let rankedHistory = $derived(rankSearchHistory($searchHistory));
	let historySuggestions = $derived.by(() => {
		const text = combobox.inputValue.trim().toLowerCase();
		const list =
			combobox.touched && text.length > 0
				? rankedHistory.filter((item) => item.toLowerCase().includes(text))
				: rankedHistory;
		return list.slice(0, 10);
	});

	$effect(() => {
		applyQuery(query);
	});

	$effect(() => {
		const promoted = $customKindTags.filter((tag) => presetKinds.includes(Number(tag.value)));
		if (promoted.length === 0) {
			return;
		}
		for (const tag of promoted) {
			selectedPresets[Number(tag.value)] = true;
		}
		customKindTags.update((tags) =>
			tags.filter((tag) => !presetKinds.includes(Number(tag.value)))
		);
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
		combobox.inputValue = [parsedKeyword, ...hashtags.map((hashtag) => `#${hashtag}`)]
			.join(' ')
			.trim();
	}

	let kinds = $derived(
		unique([
			...presetKinds.filter((kind) => selectedPresets[kind]),
			...$customKindTags.map((tag) => Number(tag.value))
		])
	);

	let q = $derived.by(() => {
		const queryKinds = kinds.length === 1 && kinds[0] === ShortTextNote ? [] : kinds;
		return buildSearchQuery({
			kinds: queryKinds,
			fromPubkeys: $fromTags.map((tag) => tag.id),
			toPubkeys: $toTags.map((tag) => tag.id),
			sinceDate: sinceDate || undefined,
			untilDate: untilDate || undefined,
			keyword
		});
	});

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

	let qInput: HTMLInputElement;

	function handleSubmit(): void {
		qInput.value = q;
		searchHistory.update((history) => pushSearchHistory(history, q));
	}

	function onInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			combobox.open = false;
			return;
		}
		combobox.input.onkeydown(event);
	}

	function selectHistory(item: string): void {
		applyQuery(item);
		combobox.open = false;
		qInput.form?.requestSubmit();
	}

	function deleteHistory(item: string): void {
		searchHistory.update((history) => history.filter((entry) => entry !== item));
	}
</script>

<form action="/search" class="card" onsubmit={handleSubmit}>
	<div class="search-row">
		<input
			{...combobox.input}
			type="search"
			name="q"
			bind:this={qInput}
			onkeydown={onInputKeydown}
			placeholder={$_('search.search')}
		/>
		<input type="submit" value={$_('search.search')} />
	</div>

	{#if combobox.open && historySuggestions.length > 0}
		<div {...combobox.content} class="history">
			<ul>
				{#each historySuggestions as item (item)}
					<li
						{...combobox.getOption(item, item, () => selectHistory(item))}
						class="history-option"
					>
						<span class="history-keyword">{item}</span>
						<button
							type="button"
							class="history-delete"
							onpointerdown={(event) => event.preventDefault()}
							onclick={(event) => {
								event.stopPropagation();
								deleteHistory(item);
							}}
						>
							<IconX size={16} />
						</button>
					</li>
				{/each}
			</ul>
			<button
				type="button"
				class="history-clear"
				onpointerdown={(event) => event.preventDefault()}
				onclick={() => searchHistory.set([])}
			>
				<IconTrash size={16} />
				{$_('search.history.clear')}
			</button>
		</div>
	{/if}

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
					autocomplete="off"
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
						{alternativeName(tag.id)}
						<button type="button" use:melt={$fromDelete(tag)} class="delete">×</button>
					</div>
				{/each}
				<input
					use:melt={$fromInput}
					type="text"
					autocomplete="off"
					placeholder={$_('search.fields.pubkeyPlaceholder')}
				/>
			</div>
		</div>

		<div class="field">
			<span class="label">{$_('search.fields.to')}</span>
			<div use:melt={$toRoot} class="tags-input">
				{#each $toTags as tag (tag.id)}
					<div use:melt={$toTag(tag)} class="tag">
						{alternativeName(tag.id)}
						<button type="button" use:melt={$toDelete(tag)} class="delete">×</button>
					</div>
				{/each}
				<input
					use:melt={$toInput}
					type="text"
					autocomplete="off"
					placeholder={$_('search.fields.pubkeyPlaceholder')}
				/>
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

	.history {
		color: var(--surface-foreground);
		background-color: var(--surface);
		border: var(--default-border);
		border-radius: var(--radius, 4px);
		padding: 0.25rem;
		max-height: 16rem;
		overflow-y: auto;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.history ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.history-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border-radius: var(--radius, 4px);
		cursor: pointer;
	}

	.history-option[data-highlighted] {
		background: var(--accent-surface, rgba(127, 127, 127, 0.15));
	}

	.history-keyword {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.history-delete {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		padding: 0.1rem;
	}

	.history-clear {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
		border: none;
		border-top: var(--default-border);
		background: transparent;
		color: var(--accent);
		cursor: pointer;
		padding: 0.4rem 0.5rem;
		margin-top: 0.25rem;
		font-size: 0.85rem;
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
