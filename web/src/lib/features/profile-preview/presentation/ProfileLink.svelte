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
	let open = $state(false);
	let content = $state<HTMLElement | null>(null);

	function setOpen(value: boolean): void {
		// Keep the preview mounted while its portalled popover is being used.
		if (!value && content?.querySelector('[data-popover-trigger][data-state="open"]')) {
			return;
		}
		open = value;
	}
</script>

<LinkPreview.Root bind:open={() => open, setOpen} openDelay={300} closeDelay={200}>
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
			bind:ref={content}
			style="z-index: 20"
			side="bottom"
			align="start"
			sideOffset={8}
			collisionPadding={8}
		>
			<ProfilePreviewCard {pubkey} />
		</LinkPreview.Content>
	</LinkPreview.Portal>
</LinkPreview.Root>
