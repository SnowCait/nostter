<script lang="ts">
	export let relay: string;
	export let read: boolean;
	export let write: boolean;
	export let readonly: boolean;
</script>

<article>
	<div class="relay">{relay}</div>
	<div class="checkbox read">
		<input type="checkbox" checked={read} class:readonly />
	</div>
	<div class="checkbox write">
		<input type="checkbox" checked={write} class:readonly />
	</div>
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

	.checkbox {
		width: 4rem;
		text-align: center;
		accent-color: gray;
	}

	.checkbox.read {
		margin-left: auto;
	}

	input[type='checkbox'].readonly {
		pointer-events: none;
	}
</style>
