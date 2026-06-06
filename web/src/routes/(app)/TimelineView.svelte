<script lang="ts">
	import type { Item } from '$lib/Items';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import { author, isMuteEvent } from '$lib/stores/Author';
	import Loading from '$lib/components/Loading.svelte';
	import EventComponent from '$lib/components/items/EventComponent.svelte';
	import { innerHeight, scrollY } from 'svelte/reactivity/window';
	import { WindowVirtualizer } from 'virtua/svelte';
	import { viewDetail } from '$lib/EventNavigation';

	interface Props {
		items?: Item[];
		readonly?: boolean;
		load?: () => Promise<void>;
		showLoading?: boolean;
		createdAtFormat?: 'auto' | 'time';
		full?: boolean;
		canTransition?: boolean;
	}

	let {
		items = [],
		readonly = false,
		load = async () => console.debug(),
		showLoading = true,
		createdAtFormat = 'auto',
		full = false,
		canTransition = true
	}: Props = $props();

	let loading = false;

	let visibleItems = $derived(
		items.filter(
			(item) =>
				!isMuteEvent(item.event) &&
				!$deletedEventIdsByPubkey.get(item.event.pubkey)?.has(item.event.id)
		)
	);

	$effect(() => {
		const maxHeight = document.documentElement.scrollHeight;
		const scrollRate = Math.floor(
			(100 * (scrollY.current! + innerHeight.current!)) / maxHeight
		);

		if (scrollRate > 80 && !loading) {
			console.debug('[timeline load more]', scrollRate);
			loading = true;
			load().then(() => {
				loading = false;
			});
		}
	});
</script>

{#if visibleItems.length > 0}
	<section class="card">
		<WindowVirtualizer data={visibleItems} getKey={(item) => item.event.id}>
			{#snippet children(data)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class={canTransition ? 'canTransition-post' : ''}
					class:related={$author?.isNotified(data.event)}
					onmouseup={(e) => viewDetail(e, data.event, canTransition)}
				>
					<EventComponent item={data} {readonly} {createdAtFormat} {full} />
				</div>
			{/snippet}
		</WindowVirtualizer>
	</section>
{/if}

{#if showLoading}
	<div class="loading"><Loading /></div>
{/if}

<style>
	section {
		margin: 0;
		padding: 0;
	}

	section div {
		border-bottom: var(--default-border);

		animation-name: add;
		animation-duration: 0.8s;

		overflow-x: hidden;
		text-overflow: ellipsis;
	}

	.canTransition-post {
		cursor: pointer;
	}

	.canTransition-post:hover {
		background: var(--accent-surface-low);
	}

	:global(blockquote) {
		cursor: pointer;
	}

	:global(.canTransition-post blockquote:hover) {
		background: var(--accent-surface-high);
	}

	:global(blockquote:hover) {
		background: var(--accent-surface-low);
	}

	.related {
		border-left: 2px solid lightcoral;
	}

	.loading {
		margin: 1rem auto;
	}

	@keyframes add {
		0% {
			opacity: 0;
		}

		100% {
			opacity: 1;
		}
	}
</style>
