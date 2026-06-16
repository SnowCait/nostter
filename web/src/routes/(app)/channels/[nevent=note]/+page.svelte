<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Event } from 'nostr-tools';
	import { decode, type EventPointer } from 'nostr-tools/nip19';
	import { _ } from 'svelte-i18n';
	import { error } from '@sveltejs/kit';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { appName } from '$lib/Constants';
	import { cachedEvents, channelMetadataEventsStore } from '$lib/cache/Events';
	import { ChannelChat } from './ChannelChat.svelte';
	import { composerFocus } from './ComposerFocus.svelte';
	import ChannelHeader from './ChannelHeader.svelte';
	import ChannelMessageList from './ChannelMessageList.svelte';
	import ChannelComposer from './ChannelComposer.svelte';

	let chat = $state<ChannelChat>();
	let replyTo = $state<Event>();

	function build(): void {
		const slug = page.params.nevent!;
		let pointer: EventPointer;
		try {
			const decoded = decode(slug);
			if (decoded.type !== 'nevent') {
				throw new Error(`Unexpected type: ${decoded.type}`);
			}
			pointer = decoded.data;
		} catch (e) {
			console.error('[channel page decode error]', slug, e);
			error(404);
		}

		const channelId = pointer.id;
		const relays = pointer.relays ?? [];
		const kind40 = cachedEvents.get(channelId);
		const kind41 = $channelMetadataEventsStore.get(channelId);

		const channelChat = new ChannelChat(channelId, relays, kind40, kind41);
		chat = channelChat;
		channelChat.start();
	}

	function onReply(event: Event): void {
		replyTo = event;
		composerFocus.current?.();
	}

	afterNavigate(() => {
		chat?.dispose();
		replyTo = undefined;
		build();
	});

	onDestroy(() => {
		chat?.dispose();
	});
</script>

<svelte:head>
	<title>{appName} - {chat?.metadata?.name ?? $_('layout.header.channels')}</title>
</svelte:head>

{#if chat !== undefined}
	<div class="channel">
		<ChannelHeader
			channelId={chat.channelId}
			metadata={chat.metadata}
			creatorPubkey={chat.creatorPubkey}
		/>
		<ChannelMessageList {chat} {onReply} />
		<ChannelComposer channelId={chat.channelId} bind:replyTo />
	</div>
{/if}

<style>
	.channel {
		display: flex;
		flex-direction: column;
		background: var(--surface);
		color: var(--surface-foreground);
		min-height: 100dvh;
		border: var(--default-border);
	}

	@media screen and (max-width: 600px) {
		.channel {
			min-height: calc(100dvh - 6.25rem);
			margin-bottom: -50px;
			border: none;
		}
	}
</style>
