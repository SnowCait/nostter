<script lang="ts">
	import { IconSend } from '@tabler/icons-svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		continuePosting: boolean;
	}

	let { continuePosting = $bindable() }: Props = $props();
</script>

<div>
	<span class="icon">
		<IconSend size="20" color="var(--accent)" />
	</span>
	<label>
		<span>{$_('editor.continue-posting')}</span>
		<input type="checkbox" bind:checked={continuePosting} />
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

	input {
		margin-left: 0.3rem;
	}
</style>
