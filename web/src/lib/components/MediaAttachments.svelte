<script lang="ts">
	import { IconTrash } from '@tabler/icons-svelte-runes';
	import { _ } from 'svelte-i18n';
	import type { LocalAttachment } from '$lib/media/LocalAttachment';
	import LocalMedia from './content/LocalMedia.svelte';

	interface Props {
		attachments: LocalAttachment[];
		disabled?: boolean;
		onRetry: (attachment: LocalAttachment) => void | Promise<void>;
		onRemove: (attachment: LocalAttachment) => void;
		onAddUrls: () => void | Promise<void>;
	}

	let { attachments, disabled = false, onRetry, onRemove, onAddUrls }: Props = $props();
</script>

{#if attachments.length > 0}
	<section class="attachments" aria-label={$_('media.attachments.title')}>
		<ul>
			{#each attachments as attachment}
				<li>
					<div class="attachment-preview">
						<LocalMedia media={{ url: attachment.previewUrl, kind: attachment.kind }} />
					</div>
					<div class="attachment-details">
						<span class="attachment-name">{attachment.file.name}</span>
						<span class="attachment-state" class:failed={attachment.state === 'failed'}>
							{$_(`media.attachments.state.${attachment.state}`)}
						</span>
					</div>
					<div class="attachment-actions">
						{#if attachment.state === 'failed'}
							<button
								class="retry-attachment"
								onclick={() => onRetry(attachment)}
								{disabled}
							>
								{$_('media.attachments.retry')}
							</button>
						{/if}
						<button
							class="remove-attachment"
							onclick={() => onRemove(attachment)}
							{disabled}
							aria-label={$_('media.attachments.remove')}
							title={$_('media.attachments.remove')}
						>
							<IconTrash size={18} />
						</button>
					</div>
				</li>
			{/each}
		</ul>
		<button class="add-urls" onclick={onAddUrls} {disabled}>
			{$_('media.attachments.add_urls')}
		</button>
	</section>
{/if}

<style>
	.attachments {
		margin: 0.25rem 0.5rem 0.5rem;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: min(12rem, 30dvh);
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(4rem, 6rem) minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem;
		border-radius: var(--radius);
		background: var(--accent-surface-low);
	}

	.attachment-preview {
		max-height: 3.5rem;
		overflow: hidden;
	}

	.attachment-preview :global(img),
	.attachment-preview :global(video) {
		min-width: 0;
		max-width: 100%;
		max-height: 3.5rem;
		margin: 0;
	}

	.attachment-preview :global(audio) {
		width: 100%;
		max-width: 100%;
		height: 2.5rem;
	}

	.attachment-details,
	.attachment-actions {
		display: flex;
		gap: 0.35rem;
	}

	.attachment-details {
		flex-direction: column;
		min-width: 0;
	}

	.attachment-actions {
		align-items: center;
		justify-content: flex-end;
	}

	.attachment-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.85rem;
	}

	.attachment-state {
		color: var(--accent-gray);
		font-size: 0.75rem;
	}

	.attachment-state.failed {
		color: var(--red);
		font-weight: bold;
	}

	.retry-attachment {
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--accent-gray);
		background: transparent;
		color: var(--accent-gray);
		font-size: 0.75rem;
	}

	.remove-attachment {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--accent-gray);
	}

	.retry-attachment:hover:not(:disabled),
	.remove-attachment:hover:not(:disabled),
	.remove-attachment:focus-visible {
		opacity: 1;
		background: var(--accent-surface-high);
		color: var(--foreground);
	}

	.retry-attachment:focus-visible,
	.remove-attachment:focus-visible,
	.add-urls:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.add-urls {
		display: block;
		width: fit-content;
		margin: 0.25rem 0 0;
		padding: 0.125rem 0.25rem;
		border-radius: 0;
		background: transparent;
		color: var(--accent-gray);
		font-size: 1rem;
		font-weight: normal;
		line-height: 1.25;
		text-decoration: none;
	}

	.add-urls:hover:not(:disabled),
	.add-urls:focus-visible {
		opacity: 1;
		color: var(--foreground);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	@media screen and (max-width: 600px) {
		ul {
			max-height: min(10rem, 25dvh);
		}

		li {
			grid-template-columns: 4rem minmax(0, 1fr) auto;
			gap: 0.35rem;
		}

		.attachment-actions {
			gap: 0.2rem;
		}
	}
</style>
