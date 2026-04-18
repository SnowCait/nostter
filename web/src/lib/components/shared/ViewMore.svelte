<script lang="ts">
	import { tick } from 'svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		onclick?: () => void | Promise<void>;
	}

	let { onclick = toggle }: Props = $props();

	let element = $state<HTMLDivElement>();
	let folded = $state(true);

	async function toggle(): Promise<void> {
		folded = !folded;
		if (folded) {
			await tick();
			element?.parentElement?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest'
			});
		}
	}
</script>

<div class:folded bind:this={element}>
	<button {onclick} class="button-outlined">
		{#if folded}
			{$_('fold.unfold')}
		{:else}
			{$_('fold.fold')}
		{/if}
	</button>
</div>

<style>
	:global(*:has(> .folded)) {
		max-height: 20rem;
		overflow: hidden;
		position: relative;
	}

	div {
		width: 100%;
		padding: 0.5rem;
		text-align: center;
	}

	div.folded {
		position: absolute;
		bottom: 0;
		background: linear-gradient(transparent, var(--surface));
	}

	button {
		background-color: var(--surface);
	}
</style>
