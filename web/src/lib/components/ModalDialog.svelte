<script lang="ts">
	export let open = false;

	let dialog: HTMLDialogElement | undefined;

	$: {
		if (open) {
			dialog?.showModal();
		} else {
			dialog?.close();
		}
	}

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
	}
</script>

<dialog
	bind:this={dialog}
	class="card"
	on:click={tryClose}
	on:keyup|stopPropagation={console.debug}
	on:close={onClose}
>
	<div class="dialog-content">
		<slot />
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
