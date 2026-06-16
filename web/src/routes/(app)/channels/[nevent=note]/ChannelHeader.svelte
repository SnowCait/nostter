<script lang="ts">
	import { npubEncode, neventEncode } from 'nostr-tools/nip19';
	import { _ } from 'svelte-i18n';
	import { page } from '$app/state';
	import { createDropdownMenu, melt } from '@melt-ui/svelte';
	import {
		IconDots,
		IconInfoCircle,
		IconMessages,
		IconPin,
		IconPinnedFilled,
		IconVolumeOff,
		IconLink,
		IconClipboard
	} from '@tabler/icons-svelte-runes';
	import type { ChannelMetadata } from '$lib/Types';
	import { author, muteEventIds } from '$lib/stores/Author';
	import { authorChannelsEventStore } from '$lib/cache/Events';
	import { mute, unmute } from '$lib/author/Mute';
	import { shareUrl } from '$lib/Share';
	import { copy } from '$lib/Clipboard';
	import Content from '$lib/components/Content.svelte';
	import OnelineProfile from '$lib/components/profile/OnelineProfile.svelte';
	import { pinChannel, unpinChannel } from './Pin';

	interface Props {
		channelId: string;
		metadata?: ChannelMetadata;
		creatorPubkey?: string;
	}

	let { channelId, metadata, creatorPubkey }: Props = $props();

	const {
		elements: { menu, item, trigger, overlay, separator }
	} = createDropdownMenu({ preventScroll: false });

	let detailsDialog = $state<HTMLDialogElement>();
	let brokenImage = $state(false);

	let pinned = $derived(
		$authorChannelsEventStore?.tags.some(
			([tagName, id]) => tagName === 'e' && id === channelId
		) ?? false
	);
	let muted = $derived($muteEventIds.includes(channelId));
	let nevent = $derived(neventEncode({ id: channelId }));
	let url = $derived(page.url.href);
	let hasDetails = $derived(creatorPubkey !== undefined || (metadata?.about ?? '') !== '');

	async function onShare(): Promise<void> {
		if (!(await shareUrl(url))) {
			await copy(url);
		}
	}
</script>

<header>
	<div class="bar">
		<div class="identity">
			<div class="avatar">
				{#if metadata?.picture && !brokenImage}
					<img src={metadata.picture} alt="" onerror={() => (brokenImage = true)} />
				{:else}
					<div class="placeholder"><IconMessages size={22} /></div>
				{/if}
			</div>
			<h1>{metadata?.name ?? ''}</h1>
			{#if hasDetails}
				<button
					class="clear details-trigger"
					title={$_('channel.about')}
					onclick={() => detailsDialog?.showModal()}
				>
					<IconInfoCircle />
				</button>
			{/if}
		</div>

		<button class="clear menu-trigger" title={$_('channel.menu')} use:melt={$trigger}>
			<IconDots />
		</button>
		<div use:melt={$overlay} class="overlay"></div>
		<div use:melt={$menu} class="menu">
			{#if $author !== undefined}
				{#if pinned}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div use:melt={$item} onclick={() => unpinChannel(channelId)} class="item undo">
						<div class="icon"><IconPinnedFilled size={18} /></div>
						<div>{$_('actions.unpin.button')}</div>
					</div>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div use:melt={$item} onclick={() => pinChannel(channelId)} class="item">
						<div class="icon"><IconPin size={18} /></div>
						<div>{$_('actions.pin.button')}</div>
					</div>
				{/if}
			{/if}
			{#if navigator.canShare !== undefined}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={onShare} class="item">
					<div class="icon"><IconLink size={18} /></div>
					<div>{$_('actions.share.button')}</div>
				</div>
			{:else}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div use:melt={$item} onclick={() => copy(url)} class="item">
					<div class="icon"><IconLink size={18} /></div>
					<div>{$_('actions.copy_url.button')}</div>
				</div>
			{/if}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div use:melt={$item} onclick={() => copy(nevent)} class="item">
				<div class="icon"><IconClipboard size={18} /></div>
				<div>{$_('actions.copy_id.button')}</div>
			</div>
			{#if $author !== undefined}
				<div use:melt={$separator} class="separator"></div>
				{#if muted}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div use:melt={$item} onclick={() => unmute('e', channelId)} class="item undo">
						<div class="icon"><IconVolumeOff size={18} /></div>
						<div>{$_('actions.unmute.button')}</div>
					</div>
				{:else}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div use:melt={$item} onclick={() => mute('e', channelId)} class="item">
						<div class="icon"><IconVolumeOff size={18} /></div>
						<div>{$_('actions.mute.button')}</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</header>

{#if hasDetails}
	<dialog
		bind:this={detailsDialog}
		class="details"
		onclick={(e) => {
			if (e.target === detailsDialog) {
				detailsDialog.close();
			}
		}}
	>
		<div class="details-body">
			<div class="details-head">
				<div class="avatar">
					{#if metadata?.picture && !brokenImage}
						<img src={metadata.picture} alt="" onerror={() => (brokenImage = true)} />
					{:else}
						<div class="placeholder"><IconMessages size={22} /></div>
					{/if}
				</div>
				<h2>{metadata?.name ?? ''}</h2>
			</div>
			{#if creatorPubkey !== undefined}
				<a class="creator" href="/{npubEncode(creatorPubkey)}">
					<OnelineProfile pubkey={creatorPubkey} />
				</a>
			{/if}
			{#if metadata?.about}
				<div class="about"><Content content={metadata.about} tags={[]} /></div>
			{/if}
		</div>
	</dialog>
{/if}

<style>
	header {
		position: sticky;
		top: 0;
		margin: 0;
		padding: 0.5rem 1rem;
		background: var(--surface);
		color: var(--surface-foreground);
		border-bottom: var(--default-border);
		z-index: 3;
	}

	@media screen and (max-width: 600px) {
		header {
			top: 3.125rem;
		}
	}

	.bar {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.identity {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		flex: 1;
	}

	.avatar {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
	}

	.avatar img,
	.placeholder {
		width: 36px;
		height: 36px;
		border-radius: var(--radius);
		object-fit: cover;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-surface-low);
		color: var(--accent-gray);
	}

	h1 {
		margin: 0;
		font-size: 1.2rem;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.details-trigger,
	.menu-trigger {
		color: var(--accent-gray);
		flex-shrink: 0;
	}

	.details {
		padding: 0;
		border: var(--default-border);
		border-radius: var(--radius);
		max-width: min(90vw, 28rem);
	}

	.details-body {
		max-height: 70vh;
		overflow: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.details-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.details-head h2 {
		margin: 0;
		font-size: 1.2rem;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.creator {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
		color: var(--accent-gray);
		text-decoration: none;
	}
</style>
