<script lang="ts">
	import { _ } from 'svelte-i18n';
	import ProfileIcon from '$lib/components/profile/ProfileIcon.svelte';
	import ProfileName from '$lib/components/profile/ProfileName.svelte';
	import CreatedAt from '$lib/components/CreatedAt.svelte';
	import Content from '$lib/components/Content.svelte';

	interface Props {
		pubkey: string | undefined;
	}

	let { pubkey }: Props = $props();

	const createdAt = 1_700_000_000;
</script>

<article class="preview" inert>
	<div class="picture">
		{#if pubkey !== undefined}
			<ProfileIcon {pubkey} tooltip={false} />
		{:else}
			<div class="sample-icon"></div>
		{/if}
	</div>
	<div class="note">
		<div class="user">
			{#if pubkey !== undefined}
				<ProfileName {pubkey} />
			{:else}
				<span class="display_name">Alice</span>
				<span class="name">@alice</span>
			{/if}
			<div class="created_at">
				<CreatedAt {createdAt} format="time" />
			</div>
		</div>
		<div class="content">
			<Content content={$_('preferences.content_font_size.preview')} tags={[]} />
		</div>
	</div>
</article>

<style>
	.preview {
		display: flex;
		gap: 12px;
		margin-top: 0.5rem;
		padding: 0.75rem 1rem;
		border: var(--default-border);
		border-radius: var(--radius);
		background-color: var(--surface);
		color: var(--surface-foreground);
	}

	.picture {
		flex-shrink: 0;
		width: 48px;
		height: 48px;
	}

	@media screen and (max-width: 600px) {
		.picture {
			width: 40px;
			height: 40px;
		}
	}

	.sample-icon {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background-color: var(--accent-surface);
	}

	.note {
		flex: 1;
		min-width: 0;
	}

	.user {
		display: flex;
		gap: 0.3rem;
		min-width: 0;
		font-size: calc(15px * var(--content-font-scale));
	}

	.user :global(.display_name) {
		font-weight: 700;
		flex-shrink: 1;
	}

	.user :global(.name) {
		color: var(--accent-gray);
		flex-shrink: 2;
	}

	.user :global(.display_name),
	.user :global(.name) {
		overflow: hidden;
		white-space: nowrap;
	}

	.created_at {
		margin-left: auto;
		flex-shrink: 0;
	}

	.content {
		margin-top: 0.2rem;
		font-size: calc(15px * var(--content-font-scale));
		--applied-content-font-scale: var(--content-font-scale);
	}
</style>
