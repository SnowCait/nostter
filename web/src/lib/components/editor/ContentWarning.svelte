<script lang="ts">
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';

	interface Props {
		reason?: string | undefined;
	}

	let { reason = $bindable(undefined) }: Props = $props();

	function onClick() {
		console.log('[content warning click]', reason);
		if (reason === undefined) {
			reason = '';
		} else {
			reason = undefined;
		}
	}
</script>

<div>
	<button onclick={onClick} class="clear" class:enable={reason !== undefined}>
		<IconEyeOff size="30" />
	</button>
	{#if reason !== undefined}
		<input type="text" bind:value={reason} placeholder="Reason" />
	{/if}
</div>

<style>
	button {
		color: var(--accent);
	}

	.enable {
		color: var(--accent-gray);
	}

	div {
		display: flex;
	}

	input[type='text'] {
		padding: 0;
		margin-left: 0.5rem;
		border: 1px solid var(--accent-gray);
	}
</style>
