<script lang="ts">
	import IconActivity from '@tabler/icons-svelte-runes/icons/activity';
	import IconExternalLink from '@tabler/icons-svelte-runes/icons/external-link';
	import IconMusic from '@tabler/icons-svelte-runes/icons/music';
	import EmojifiedContent from '$lib/components/EmojifiedContent.svelte';
	import { userStatuses, type DisplayedUserStatus } from '../application/user-statuses.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let statuses = $derived(userStatuses.get(pubkey));

	$effect(() => userStatuses.observe(pubkey));
</script>

{#snippet row(status: DisplayedUserStatus, icon: typeof IconActivity)}
	{@const Icon = icon}
	<div class="status">
		<span class="icon"><Icon size={16} /></span>
		{#if status.link !== undefined}
			<a
				class="content link"
				href={status.link.href}
				target="_blank"
				rel="noopener noreferrer"
			>
				<span class="text">
					<EmojifiedContent content={status.content} tags={status.tags} />
				</span>
				<span class="indicator" aria-hidden="true"><IconExternalLink size={12} /></span>
			</a>
		{:else}
			<span class="content">
				<span class="text">
					<EmojifiedContent content={status.content} tags={status.tags} />
				</span>
			</span>
		{/if}
	</div>
{/snippet}

{#if statuses.general !== undefined || statuses.music !== undefined}
	<div class="user-status-stacked">
		{#if statuses.general !== undefined}
			{@render row(statuses.general, IconActivity)}
		{/if}
		{#if statuses.music !== undefined}
			{@render row(statuses.music, IconMusic)}
		{/if}
	</div>
{/if}

<style>
	.user-status-stacked {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		color: var(--accent-gray);
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}

	.icon {
		display: flex;
		justify-content: center;
		flex-shrink: 0;
		width: 1.25rem;
	}

	.content {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.link {
		gap: 0.125rem;
		color: inherit;
		text-decoration: none;
		border-radius: 0.25rem;
	}

	.link:hover,
	.link:focus-visible {
		color: var(--accent);
	}

	.link:hover .text,
	.link:focus-visible .text {
		text-decoration: underline;
	}

	.link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.indicator {
		display: flex;
		flex-shrink: 0;
	}
</style>
