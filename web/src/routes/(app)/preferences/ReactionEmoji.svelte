<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { toEmoji } from '$lib/Emoji';
	import { preferencesStore, savePreferences } from '$lib/Preferences';
	import IconHeart from '@tabler/icons-svelte/icons/heart';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import CustomEmoji from '$lib/components/content/CustomEmoji.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
		savePreferences();
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
