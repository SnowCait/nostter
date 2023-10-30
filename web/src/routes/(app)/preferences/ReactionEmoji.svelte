<script lang="ts">
	import { now } from 'rx-nostr';
	import { reactionEmoji } from '../../../stores/Preference';
	import type { Emoji } from '$lib/Emoji';
	import { Signer } from '$lib/Signer';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import EmojiPicker from '../parts/EmojiPicker.svelte';

	async function save(emoji: Emoji) {
		console.log('[reaction emoji save]', emoji, $reactionEmoji);

		if (emoji.content === $reactionEmoji.content && emoji.url === $reactionEmoji.url) {
			console.log('[reaction emoji not changed]');
			return;
		}

		$reactionEmoji = emoji;

		// Save
		const event = await Signer.signEvent({
			created_at: now(),
			kind: 30078,
			tags: [['d', 'nostter-reaction-emoji']],
			content: $reactionEmoji.content
		});
		console.log('[reaction emoji]', event);
		rxNostr.send(event).subscribe((packet) => {
			console.log('[rx-nostr send]', packet);
		});
	}
</script>

<span>Like emoji:</span>
<EmojiPicker on:pick={async ({ detail }) => save({ content: detail.native })}>
	{#if $reactionEmoji.content === '+'}
		<IconHeart size={26} color={'lightpink'} />
	{:else}
		<span class="emoji">{$reactionEmoji.content}</span>
	{/if}
</EmojiPicker>

<style>
	.emoji {
		font-size: 20px;
	}
</style>
