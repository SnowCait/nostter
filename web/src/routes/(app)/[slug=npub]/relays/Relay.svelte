<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import IconTrash from '@tabler/icons-svelte/icons/trash';

	export let relay: { url: string; read: boolean; write: boolean };
	export let readonly: boolean;

	const dispatch = createEventDispatcher();

	function remove() {
		dispatch('remove');
		return false;
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
			<button on:click|preventDefault={remove} class="clear">
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
