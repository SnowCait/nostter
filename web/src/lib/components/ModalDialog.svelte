<script lang="ts">
	import { run, createBubbler, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import { createEventDispatcher } from 'svelte';

	interface Props {
		open?: boolean;
		children?: import('svelte').Snippet;
	}

	let { open = $bindable(false), children }: Props = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	const dispatch = createEventDispatcher();

	run(() => {
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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	class="card"
	onclick={tryClose}
	onkeyup={stopPropagation(bubble('keyup'))}
	onclose={onClose}
>
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
