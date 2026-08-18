<script lang="ts">
	import { createRxOneshotReq, uniq } from 'rx-nostr';
	import type * as Nostr from 'nostr-typedef';
	import { tap } from 'rxjs';
	import { onDestroy, tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { pubkey as authorPubkey, rom } from '$lib/stores/Author';
	import TimelineView from '../../TimelineView.svelte';
	import {
		bookmarkEvent,
		copyLegacyBookmarks,
		deleteLegacyBookmarks,
		legacyBookmarkEvent
	} from '$lib/author/Bookmark';
	import { addToast } from '$lib/components/Toaster.svelte';
	import { authorActionReqEmit } from '$lib/author/Action';
	import { appName, reverseChronologicalItem } from '$lib/Constants';
	import { filterTags } from '$lib/EventHelper';
	import { EventItem } from '$lib/Items';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import type { LayoutProps } from '../$types';
	import { decryptListContent } from '$lib/List';
	import {
		getAdjacentBookmarkListTab,
		legacyBookmarkListId,
		resolveSelectedBookmarkList
	} from './BookmarkListTabs';
	import { BookmarkPageState } from './BookmarkPageState.svelte';

	let { data }: LayoutProps = $props();

	let privateBookmarkEventItems: EventItem[] = $state([]);
	let privateLegacyBookmarkEventItems: EventItem[] = $state([]);
	let copyingLegacyBookmarks = $state(false);
	let deletingLegacyBookmarks = $state(false);

	async function copyAllLegacyBookmarks(): Promise<void> {
		if (copyingLegacyBookmarks) return;
		copyingLegacyBookmarks = true;
		try {
			await copyLegacyBookmarks();
			addToast({
				data: {
					title: $_('bookmarks.copy.success.title'),
					description: $_('bookmarks.copy.success.description')
				}
			});
		} catch (error) {
			console.error('[legacy bookmarks copy failed]', error);
			addToast({
				data: {
					title: $_('bookmarks.copy.failed.title'),
					description: $_('bookmarks.copy.failed.description')
				}
			});
		} finally {
			copyingLegacyBookmarks = false;
		}
	}

	async function deleteAllLegacyBookmarks(): Promise<void> {
		if (deletingLegacyBookmarks || !confirm($_('bookmarks.delete.confirm'))) return;
		deletingLegacyBookmarks = true;
		try {
			await deleteLegacyBookmarks();
			addToast({
				data: {
					title: $_('bookmarks.delete.success.title'),
					description: $_('bookmarks.delete.success.description')
				}
			});
		} catch (error) {
			console.error('[legacy bookmarks delete failed]', error);
			addToast({
				data: {
					title: $_('bookmarks.delete.failed.title'),
					description: $_('bookmarks.delete.failed.description')
				}
			});
		} finally {
			deletingLegacyBookmarks = false;
		}
	}

	function loadPublicItems(event: Nostr.Event, addItem: (item: EventItem) => void): () => void {
		const ids = filterTags('e', event.tags);
		if (ids.length === 0) {
			return () => {};
		}
		const eventsReq = createRxOneshotReq({ filters: [{ ids }] });
		const subscription = rxNostr
			.use(eventsReq)
			.pipe(
				tie,
				uniq(),
				tap(({ event }) => {
					referencesReqEmit(event);
					authorActionReqEmit(event);
				})
			)
			.subscribe(({ event }) => addItem(new EventItem(event)));
		return () => subscription.unsubscribe();
	}

	const pageState = new BookmarkPageState(
		bookmarkEvent,
		legacyBookmarkEvent,
		loadPublicItems,
		reverseChronologicalItem
	);
	onDestroy(() => pageState.destroy());
	let bookmarkListTabs = $derived(pageState.bookmarkListTabs);
	let selectedBookmarkList = $derived(
		resolveSelectedBookmarkList(bookmarkListTabs, pageState.selectedBookmarkListId)
	);

	function getTabLabel(id: string): string {
		return id === legacyBookmarkListId
			? $_('bookmarks.old_format')
			: $_('layout.header.bookmarks');
	}

	function selectBookmarkList(id: string): void {
		pageState.selectBookmarkList(id);
	}

	async function handleTabKeydown(event: KeyboardEvent): Promise<void> {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
			return;
		}

		event.preventDefault();
		const nextTab = getAdjacentBookmarkListTab(
			bookmarkListTabs,
			selectedBookmarkList?.id ?? pageState.selectedBookmarkListId,
			event.key === 'ArrowLeft' ? -1 : 1
		);
		if (nextTab === undefined) {
			return;
		}

		selectBookmarkList(nextTab.id);
		await tick();
		const tabList = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
		tabList?.querySelector<HTMLElement>(`[role="tab"][data-tab-id="${nextTab.id}"]`)?.focus();
	}

	// Private bookmarks
	$effect(() => {
		privateBookmarkEventItems = [];
		if (
			data.pubkey === $authorPubkey &&
			!$rom &&
			$bookmarkEvent !== undefined &&
			$bookmarkEvent.content !== ''
		) {
			decryptListContent($authorPubkey, $bookmarkEvent.content).then(([tags]) => {
				const ids = filterTags('e', tags);
				if (ids.length > 0) {
					const eventsReq = createRxOneshotReq({
						filters: [
							{
								ids
							}
						]
					});
					rxNostr
						.use(eventsReq)
						.pipe(
							tie,
							uniq(),
							tap(({ event }) => {
								referencesReqEmit(event);
								authorActionReqEmit(event);
							})
						)
						.subscribe((packet) => {
							console.debug('[bookmark private]', packet);
							privateBookmarkEventItems.push(new EventItem(packet.event));
							privateBookmarkEventItems = privateBookmarkEventItems.toSorted(
								(a, b) => b.event.created_at - a.event.created_at
							);
						});
				}
			});
		}
	});

	// Private legacy bookmarks
	$effect(() => {
		privateLegacyBookmarkEventItems = [];
		if (
			data.pubkey === $authorPubkey &&
			!$rom &&
			$legacyBookmarkEvent !== undefined &&
			$legacyBookmarkEvent.content !== ''
		) {
			decryptListContent($authorPubkey, $legacyBookmarkEvent.content).then(([tags]) => {
				const ids = filterTags('e', tags);
				if (ids.length > 0) {
					const eventsReq = createRxOneshotReq({ filters: [{ ids }] });
					rxNostr
						.use(eventsReq)
						.pipe(
							tie,
							uniq(),
							tap(({ event }) => {
								referencesReqEmit(event);
								authorActionReqEmit(event);
							})
						)
						.subscribe((packet) => {
							console.debug('[legacy bookmark private]', packet);
							privateLegacyBookmarkEventItems.push(new EventItem(packet.event));
							privateLegacyBookmarkEventItems =
								privateLegacyBookmarkEventItems.sort(reverseChronologicalItem);
						});
				}
			});
		}
	});
</script>

<svelte:head>
	<title>{appName} - {$_('layout.header.bookmarks')}</title>
</svelte:head>

<h1>{$_('layout.header.bookmarks')}</h1>

<div class="bookmark-tabs" role="tablist" aria-label={$_('layout.header.bookmarks')}>
	{#each bookmarkListTabs as tab}
		<button
			class="bookmark-tab"
			type="button"
			role="tab"
			id={`bookmark-tab-${tab.id}`}
			data-tab-id={tab.id}
			aria-controls={`bookmark-panel-${tab.id}`}
			aria-selected={selectedBookmarkList?.id === tab.id}
			tabindex={selectedBookmarkList?.id === tab.id ? 0 : -1}
			onclick={() => selectBookmarkList(tab.id)}
			onkeydown={handleTabKeydown}
		>
			{getTabLabel(tab.id)}
		</button>
	{/each}
</div>

{#each bookmarkListTabs as tab}
	{@const publicItems =
		tab.id === legacyBookmarkListId
			? pageState.publicLegacyBookmarkEventItems
			: pageState.publicBookmarkEventItems}
	{@const privateItems =
		tab.id === legacyBookmarkListId
			? privateLegacyBookmarkEventItems
			: privateBookmarkEventItems}
	<div
		id={`bookmark-panel-${tab.id}`}
		role="tabpanel"
		aria-labelledby={`bookmark-tab-${tab.id}`}
		hidden={selectedBookmarkList?.id !== tab.id}
	>
		{#if tab.id === legacyBookmarkListId && data.pubkey === $authorPubkey && !$rom}
			<div class="legacy-actions">
				<div>
					<button
						type="button"
						disabled={copyingLegacyBookmarks}
						onclick={copyAllLegacyBookmarks}
					>
						{copyingLegacyBookmarks
							? $_('bookmarks.copy.running')
							: $_('bookmarks.copy.action')}
					</button>
					<p>{$_('bookmarks.copy.description')}</p>
				</div>
				<button
					class="delete-legacy"
					type="button"
					disabled={deletingLegacyBookmarks}
					onclick={deleteAllLegacyBookmarks}
				>
					{deletingLegacyBookmarks
						? $_('bookmarks.delete.running')
						: $_('bookmarks.delete.action')}
				</button>
			</div>
		{/if}
		<h2>{$_('pages.public')}</h2>

		<TimelineView items={publicItems} showLoading={false} />

		{#if privateItems.length > 0}
			<h2>{$_('bookmarks.private')}</h2>

			<TimelineView items={privateItems} showLoading={false} />
		{/if}
	</div>
{/each}

<style>
	.bookmark-tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		border-bottom: var(--default-border);
		user-select: none;
		overflow-x: auto;
		overflow-y: hidden;
		flex-wrap: nowrap;
	}

	.bookmark-tab {
		flex: 0 0 auto;
		padding: 0.75rem 1rem;
		border: 0;
		border-bottom: 3px solid transparent;
		border-radius: 0;
		background: transparent;
		color: var(--foreground);
		font: inherit;
		font-weight: normal;
		white-space: nowrap;
		cursor: pointer;
		opacity: 1;
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;
	}

	.bookmark-tab:hover {
		background-color: var(--hover-background-color);
		opacity: 1;
	}

	.bookmark-tab:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	.bookmark-tab[aria-selected='true'] {
		border-bottom-color: var(--accent);
		font-weight: bold;
	}

	.legacy-actions {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		border: var(--default-border);
		border-radius: 0.5rem;
	}

	.legacy-actions p {
		margin: 0.5rem 0 0;
		color: var(--subtle);
	}

	.delete-legacy {
		color: var(--danger, #c62828);
		white-space: nowrap;
	}
</style>
