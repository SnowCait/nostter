<script lang="ts">
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';
	import { _ } from 'svelte-i18n';

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
	<button
		onclick={onClick}
		class="clear editor-option active"
		class:enable={reason !== undefined}
		title={$_('editor.content-warning.title')}
	>
		<IconEyeOff size="20" />
	</button>
	{#if reason !== undefined}
		<input type="text" bind:value={reason} placeholder={$_('editor.content-warning.reason')} />
	{/if}
</div>

<style>
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
