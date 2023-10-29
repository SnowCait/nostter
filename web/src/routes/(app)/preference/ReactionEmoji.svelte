<script lang="ts">
	import { reactionEmoji } from '../../../stores/Preference';
	import { pool } from '../../../stores/Pool';
	import { writeRelays } from '../../../stores/Author';
	import { Signer } from '$lib/Signer';
	import type { Kind } from 'nostr-tools';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import EmojiPicker from '../parts/EmojiPicker.svelte';

	async function save(emoji: string) {
		console.log('[reaction emoji save]', emoji, $reactionEmoji);

		if (emoji === $reactionEmoji) {
			console.log('[reaction emoji not changed]');
			return;
		}

		$reactionEmoji = emoji;

		// Save
		const event = await Signer.signEvent({
			created_at: Math.round(Date.now() / 1000),
			kind: 30078 as Kind,
			tags: [['d', 'nostter-reaction-emoji']],
			content: $reactionEmoji
		});
		console.log('[reaction emoji]', event);
		await $pool.publish($writeRelays, event);
	}
</script>

<span>Like emoji:</span>
<EmojiPicker on:pick={async ({ detail }) => save(detail.native)}>
	{#if $reactionEmoji === '+'}
		<IconHeart size={26} color={'lightpink'} />
	{:else}
		<span class="emoji">{$reactionEmoji}</span>
	{/if}
</EmojiPicker>

<style>
	.emoji {
		font-size: 20px;
	}
</style>
