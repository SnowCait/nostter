<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { WindowVirtualizer } from 'virtua/svelte';
	import { innerHeight, scrollY } from 'svelte/reactivity/window';
	import { IconArrowDown } from '@tabler/icons-svelte-runes';
	import { isMuteEvent } from '$lib/stores/Author';
	import { deletedEventIdsByPubkey } from '$lib/author/Delete';
	import Loading from '$lib/components/Loading.svelte';
	import type { ChannelChat } from './ChannelChat.svelte';
	import ChannelMessage from './ChannelMessage.svelte';

	type VirtualizerRef = {
		scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end' }) => void;
	};

	interface Props {
		chat: ChannelChat;
		onReply?: (event: Event) => void;
	}

	let { chat, onReply }: Props = $props();

	const lang = typeof navigator !== 'undefined' ? navigator.language : 'en';
	const groupingThreshold = 5 * 60;

	let ref = $state<VirtualizerRef>();

	let atBottom = true;
	let initialScrolled = false;
	let lastSeq = 0;

	let unread = $state(0);
	let selectedId = $state<string>();

	let visible = $derived(
		chat.messages.filter(
			(event) =>
				!isMuteEvent(event) && !$deletedEventIdsByPubkey.get(event.pubkey)?.has(event.id)
		)
	);

	function sameDay(a: number, b: number): boolean {
		const da = new Date(a * 1000);
		const db = new Date(b * 1000);
		return (
			da.getFullYear() === db.getFullYear() &&
			da.getMonth() === db.getMonth() &&
			da.getDate() === db.getDate()
		);
	}

	function dayLabel(createdAt: number): string {
		const date = new Date(createdAt * 1000);
		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(today.getDate() - 1);
		if (sameDay(createdAt, today.getTime() / 1000)) {
			return 'Today';
		}
		if (sameDay(createdAt, yesterday.getTime() / 1000)) {
			return 'Yesterday';
		}
		return date.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
	}

	function scrollToBottom(): void {
		const length = visible.length;
		if (length > 0) {
			ref?.scrollToIndex(length - 1, { align: 'end' });
		}
	}

	export function jumpToBottom(): void {
		unread = 0;
		atBottom = true;
		scrollToBottom();
	}

	$effect(() => {
		const y = scrollY.current ?? 0;
		const height = innerHeight.current ?? 0;
		const max = document.documentElement.scrollHeight;

		atBottom = y + height >= max - 80;
		if (atBottom) {
			unread = 0;
		}

		if (y < 400 && !chat.loading && !chat.reachedStart && visible.length > 0) {
			chat.loadOlder();
		}
	});

	$effect(() => {
		const length = visible.length;
		if (!initialScrolled && length > 0) {
			initialScrolled = true;
			tick().then(scrollToBottom);
		}
	});

	$effect(() => {
		const seq = chat.liveSeq;
		if (seq === lastSeq) {
			return;
		}
		const delta = seq - lastSeq;
		lastSeq = seq;
		if (atBottom) {
			tick().then(scrollToBottom);
		} else {
			unread += delta;
		}
	});
</script>

<div class="chat">
	{#if chat.loading && visible.length === 0}
		<div class="loading"><Loading /></div>
	{/if}

	<WindowVirtualizer
		bind:this={ref}
		data={visible}
		getKey={(event) => event.id}
		shift={chat.shift}
	>
		{#snippet children(event, index)}
			{@const previous = visible[index - 1]}
			{@const newDay =
				previous === undefined || !sameDay(previous.created_at, event.created_at)}
			{@const compact =
				!newDay &&
				previous !== undefined &&
				previous.pubkey === event.pubkey &&
				event.created_at - previous.created_at < groupingThreshold}
			{#if newDay}
				<div class="day-separator"><span>{dayLabel(event.created_at)}</span></div>
			{/if}
			<ChannelMessage
				{event}
				{compact}
				{onReply}
				selected={selectedId === event.id}
				onSelect={(id) => (selectedId = selectedId === id ? undefined : id)}
			/>
		{/snippet}
	</WindowVirtualizer>
</div>

{#if unread > 0}
	<button class="unread" onclick={jumpToBottom}>
		<IconArrowDown size={16} />
		{unread}
		{$_('channel.unread')}
	</button>
{/if}

<style>
	.chat {
		flex: 1;
	}

	.loading {
		margin: 1rem auto;
		text-align: center;
	}

	.day-separator {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0.5rem 0;
		color: var(--accent-gray);
		font-size: 0.8rem;
	}

	.day-separator span {
		padding: 0.1rem 0.6rem;
		border: var(--default-border);
		border-radius: 999px;
	}

	.unread {
		position: fixed;
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.8rem;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		cursor: pointer;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}
</style>
