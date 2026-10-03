<script lang="ts">
	import IconActivity from '@tabler/icons-svelte-runes/icons/activity';
	import IconMusic from '@tabler/icons-svelte-runes/icons/music';
	import EmojifiedContent from '$lib/components/EmojifiedContent.svelte';
	import { userStatuses } from '../application/user-statuses.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let statuses = $derived(userStatuses.get(pubkey));

	$effect(() => userStatuses.observe(pubkey));
</script>

{#if statuses.general !== undefined || statuses.music !== undefined}
	<div class="user-status-inline">
		{#if statuses.general !== undefined}
			<span class="status general">
				<span class="icon"><IconActivity size={14} /></span>
				<span class="content">
					<EmojifiedContent
						content={statuses.general.content}
						tags={statuses.general.tags}
					/>
				</span>
			</span>
		{/if}
		{#if statuses.music !== undefined}
			<span class="status music">
				<span class="icon"><IconMusic size={14} /></span>
				<span class="content">
					<EmojifiedContent content={statuses.music.content} tags={statuses.music.tags} />
				</span>
			</span>
		{/if}
	</div>
{/if}

<style>
	.user-status-inline {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		color: var(--accent-gray);
		font-size: calc(0.7rem * var(--content-font-scale));
	}

	.status {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.general {
		flex-shrink: 1;
	}

	.music {
		flex-shrink: 2;
	}

	.icon {
		display: flex;
		flex-shrink: 0;
	}

	.content {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
