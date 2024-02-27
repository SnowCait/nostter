<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { BaseEmoji } from '@types/emoji-mart';
	import data from '@emoji-mart/data';
	import { browser } from '$app/environment';
	import { customEmojiTags } from '../../../stores/CustomEmojis';
	import IconMoodSmile from '@tabler/icons-svelte/dist/svelte/icons/IconMoodSmile.svelte';

	let emojiPicker: HTMLElement | null = null;
	let hidden = true;

	const dispatch = createEventDispatcher();

	if (browser) {
		customEmojiTags.subscribe(() => {
			updatePicker();
		});
	}

	async function updatePicker() {
		if (emojiPicker === null) {
			return;
		}

		if (emojiPicker.firstChild !== null) {
			emojiPicker.removeChild(emojiPicker.firstChild);
		}

		const customEmojis = $customEmojiTags.map(([, shortcode, url]) => {
			return {
				id: shortcode,
				name: shortcode,
				keywords: [shortcode],
				skins: [
					{
						shortcodes: `:${shortcode}:`,
						src: url
					}
				]
			};
		});
		console.log('[emoji picker slide]', customEmojis);
		const { Picker } = await import('emoji-kitchen-mart');
		const picker = new Picker({
			data,
			onEmojiSelect,
			custom: [
				{
					id: 'custom-emoji',
					name: 'Custom Emojis',
					emojis: customEmojis
				}
			]
		});
		emojiPicker.appendChild(picker as any);
	}

	async function onClick() {
		updatePicker();
		hidden = !hidden;
	}

	export function hide() {
		hidden = true;
	}

	function onEmojiSelect(emoji: BaseEmoji) {
		console.debug('[emoji picker selected]', emoji);
		dispatch('pick', emoji);
	}
</script>

<div>
	<button on:click={onClick} class="clear emoji-picker">
		<slot>
			<IconMoodSmile size={30} />
		</slot>
	</button>
	<div
		class="emoji-picker"
		bind:this={emojiPicker}
		class:hidden
		on:keyup|stopPropagation={console.debug}
	/>
</div>

<style>
	div.emoji-picker {
		position: fixed;
	}

	button {
		color: var(--accent);
		height: 30px;
	}

	div.hidden {
		display: none;
	}
</style>
