<script lang="ts">
	import type { Snippet } from 'svelte';
	import { LinkPreview } from 'bits-ui';
	import { npubEncode } from 'nostr-tools/nip19';
	import ProfilePreviewCard from './ProfilePreviewCard.svelte';

	interface Props {
		pubkey: string;
		href?: string;
		children: Snippet;
	}

	let { pubkey, href, children }: Props = $props();
</script>

<LinkPreview.Root openDelay={300} closeDelay={200}>
	<LinkPreview.Trigger href={href ?? `/${npubEncode(pubkey)}`}>
		{#snippet child({ props })}
			<!-- Bits UI marks the trigger as a button; keep the implicit link role. -->
			<a {...props} role={null}>
				{@render children()}
			</a>
		{/snippet}
	</LinkPreview.Trigger>
	<LinkPreview.Portal>
		<LinkPreview.Content
			class="profile-preview"
			side="bottom"
			align="start"
			sideOffset={8}
			collisionPadding={8}
		>
			<ProfilePreviewCard {pubkey} />
		</LinkPreview.Content>
	</LinkPreview.Portal>
</LinkPreview.Root>

<style>
	/* Bits UI copies this onto its positioned wrapper, so the card stays above fixed navigation. */
	:global(.profile-preview) {
		z-index: 20;
	}
</style>
