<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		open?: boolean;
		children?: import('svelte').Snippet;
	}

	let { open = $bindable(false), children }: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	const dispatch = createEventDispatcher();

	$effect(() => {
		if (open) {
			dialog?.showModal();
		} else {
			dialog?.close();
		}
	});

	function tryClose(e: MouseEvent): void {
		const element = (e.target as Element).closest('.dialog-content');
		console.debug('[dialog try close]', element, dialog);
		if (element === null && dialog !== undefined) {
			open = false;
		}
	}

	// For ESC
	function onClose(): void {
		console.debug('[dialog on close]');
		open = false;
		dispatch('close');
	}
</script>

<dialog bind:this={dialog} class="card" onclick={tryClose} onclose={onClose}>
	<div class="dialog-content">
		{@render children?.()}
	</div>
</dialog>

<style>
	dialog {
		border: var(--default-border);
		border-radius: var(--radius);
	}

	.dialog-content {
		margin: 0.5rem;
	}
</style>
