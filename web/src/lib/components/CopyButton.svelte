<script lang="ts">
	import { copy as copyText } from '$lib/Clipboard';
	import IconClipboard from '@tabler/icons-svelte/icons/clipboard';
	import IconClipboardCheck from '@tabler/icons-svelte/icons/clipboard-check';

	export let text: string;
	export let size = 18;

	let copied = false;

	const copy = async () => {
		copyText(text);
		copied = true;
		await new Promise<void>((resolve) => {
			setTimeout(() => {
				copied = false;
				resolve();
			}, 2000);
		});
	};
</script>

<button on:click={copy}>
	{#if copied}
		<IconClipboardCheck {size} />
	{:else}
		<IconClipboard {size} />
	{/if}
</button>

<style>
	button {
		padding: 0;
		background: none;
		color: var(--accent-gray);
		display: flex;
		align-items: center;
	}
</style>
