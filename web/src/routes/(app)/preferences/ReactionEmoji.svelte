<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { now } from 'rx-nostr';
	import { toEmoji } from '$lib/Emoji';
	import { preferencesStore } from '$lib/Preferences';
	import { Signer } from '$lib/Signer';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import IconHeart from '@tabler/icons-svelte/dist/svelte/icons/IconHeart.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import CustomEmoji from '../content/CustomEmoji.svelte';

	async function save({ detail }: { detail: any }) {
		const emoji = toEmoji(detail);
		console.log('[reaction emoji save]', emoji, $preferencesStore.reactionEmoji);

		if (
			emoji.content === $preferencesStore.reactionEmoji.content &&
			emoji.url === $preferencesStore.reactionEmoji.url
		) {
			console.log('[reaction emoji not changed]');
			return;
		}

		$preferencesStore.reactionEmoji = emoji;

		const event = await Signer.signEvent({
			created_at: now(),
			kind: 30078,
			tags: [['d', 'nostter-preferences']],
			content: $preferencesStore.toJson()
		});
		console.log('[reaction emoji]', event);
		rxNostr.send(event).subscribe((packet) => {
			console.log('[rx-nostr send]', packet);
		});
	}
</script>

<span>{$_('preferences.emoji.like')}:</span>
<EmojiPicker on:pick={save}>
	{#if $preferencesStore.reactionEmoji.content === '+'}
		<IconHeart size={26} color={'lightpink'} />
	{:else if $preferencesStore.reactionEmoji.url !== undefined}
		<CustomEmoji
			url={$preferencesStore.reactionEmoji.url}
			text={$preferencesStore.reactionEmoji.content.replaceAll(':', '')}
		/>
	{:else}
		<span class="emoji">{$preferencesStore.reactionEmoji.content}</span>
	{/if}
</EmojiPicker>

<style>
	.emoji {
		font-size: 20px;
	}
</style>
