<script lang="ts">
	import IconTrash from '@tabler/icons-svelte-runes/icons/trash';

	interface Props {
		relay: { url: string; read: boolean; write: boolean };
		readonly: boolean;
		onRemove?: () => void;
	}

	let { relay = $bindable(), readonly, onRemove }: Props = $props();

	function remove(): void {
		onRemove?.();
	}
</script>

<article>
	<div class="relay">{relay.url}</div>
	<div class="checkbox read">
		<input type="checkbox" bind:checked={relay.read} class:readonly />
	</div>
	<div class="checkbox write">
		<input type="checkbox" bind:checked={relay.write} class:readonly />
	</div>
	{#if !readonly}
		<div class="remove">
			<button type="button" onclick={remove} class="clear">
				<IconTrash size={17} />
			</button>
		</div>
	{/if}
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
		padding: 4px;
	}

	.relay {
		max-width: calc(100% - 8rem);
		word-break: break-all;
	}

	.checkbox,
	.remove {
		width: 4rem;
		text-align: center;
	}

	.checkbox.read {
		margin-left: auto;
	}

	input[type='checkbox'].readonly {
		pointer-events: none;
		accent-color: gray;
	}

	button {
		color: var(--accent-gray);
	}
</style>
