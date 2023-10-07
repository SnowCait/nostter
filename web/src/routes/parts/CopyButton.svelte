<script lang="ts">
	import IconClipboard from '@tabler/icons-svelte/dist/svelte/icons/IconClipboard.svelte';
	import IconClipboardCheck from '@tabler/icons-svelte/dist/svelte/icons/IconClipboardCheck.svelte';

	export let text: string;
	export let size = 18;

	let copied = false;

	const copy = async () => {
		navigator.clipboard.writeText(text);
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
