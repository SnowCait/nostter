<script lang="ts">
	import IconEyeOff from '@tabler/icons-svelte/icons/eye-off';
	import { _ } from 'svelte-i18n';

	interface Props {
		reason?: string | undefined;
	}

	let { reason = $bindable(undefined) }: Props = $props();

	function onClick() {
		if (reason === undefined) {
			reason = '';
		} else {
			reason = undefined;
		}
	}
</script>

<div>
	<span class="icon">
		<IconEyeOff size="20" color="var(--accent)" />
	</span>
	<label>
		<span>
			{$_('editor.content-warning.title')}
		</span>
		<input type="checkbox" onchange={onClick} checked={reason !== undefined} />
		{#if reason !== undefined}
			<input
				type="text"
				bind:value={reason}
				placeholder={$_('editor.content-warning.reason')}
			/>
		{/if}
	</label>
</div>

<style>
	div {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--foreground);
	}

	.icon {
		display: inline-flex;
	}

	input[type='checkbox'] {
		margin-left: 0.3rem;
	}

	input[type='text'] {
		padding: 0 0.5rem;
		margin-left: 0.5rem;
		border: 1px solid var(--accent-gray);
		height: 1.5rem;
	}
</style>
