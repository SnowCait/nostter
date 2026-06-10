<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import { _ } from 'svelte-i18n';
	import type { Attachment } from 'svelte/attachments';

	interface Props {
		children: Snippet;
		maxHeightRem?: number;
		enabled?: boolean;
	}

	let { children, maxHeightRem = 20, enabled = true }: Props = $props();

	let container = $state<HTMLDivElement>();
	let overflowing = $state(false);
	let folded = $state(true);

	const observe: Attachment<HTMLElement> = (element) => {
		const maxHeight = maxHeightRem * parseFloat(getComputedStyle(element).fontSize);
		let frame: number | undefined;
		const observer = new ResizeObserver(() => {
			if (frame === undefined) {
				frame = requestAnimationFrame(() => {
					frame = undefined;
					overflowing = element.scrollHeight > maxHeight;
				});
			}
		});
		observer.observe(element);
		return () => {
			observer.disconnect();
			if (frame !== undefined) {
				cancelAnimationFrame(frame);
			}
		};
	};

	async function toggle(): Promise<void> {
		folded = !folded;
		if (folded) {
			await tick();
			container?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}
	}
</script>

<div
	bind:this={container}
	class:folded={enabled && overflowing && folded}
	style:--fold-max-height="{maxHeightRem}rem"
	{@attach observe}
>
	{@render children()}
	{#if enabled && overflowing}
		<div class="view-more">
			<button onclick={toggle} class="rounded-button small">
				{#if folded}
					{$_('fold.unfold')}
				{:else}
					{$_('fold.fold')}
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.folded {
		max-height: var(--fold-max-height);
		overflow: hidden;
		position: relative;
	}

	.view-more {
		width: 100%;
		padding: 0.5rem;
		text-align: center;
	}

	.folded .view-more {
		position: absolute;
		bottom: 0;
		background: linear-gradient(transparent, var(--surface));
	}

	button {
		background-color: var(--surface);
	}
</style>
