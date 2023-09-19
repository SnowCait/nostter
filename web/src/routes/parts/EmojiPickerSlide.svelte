<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Picker } from 'emoji-kitchen-mart';
	import type { BaseEmoji } from '@types/emoji-mart';
	import data from '@emoji-mart/data';
	import IconMoodSmile from '@tabler/icons-svelte/dist/svelte/icons/IconMoodSmile.svelte';
	import { customEmojiTags } from '../../stores/CustomEmojis';
	import { onMount } from 'svelte';

	let emojiPicker: HTMLElement;
	let hidden = true;

	const dispatch = createEventDispatcher();

	onMount(() => {
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
		console.log('[emoji picker slide on mount]', customEmojis);
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
	});

	async function onClick() {
		hidden = !hidden;
	}

	function onEmojiSelect(emoji: BaseEmoji) {
		console.debug('[emoji picker selected]', emoji);
		dispatch('pick', emoji);
	}
</script>

<button on:click={onClick} class="clear emoji-picker">
	<slot>
		<IconMoodSmile size={30} />
	</slot>
</button>
<div bind:this={emojiPicker} class:hidden on:keyup|stopPropagation={console.debug} />

<style>
	button {
		color: var(--color, black);
		height: 30px;
	}

	div.hidden {
		display: none;
	}
</style>
