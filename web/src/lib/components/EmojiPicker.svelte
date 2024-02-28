<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { BaseEmoji } from '@types/emoji-mart';
	import data from '@emoji-mart/data';
	import { computePosition, flip, shift } from '@floating-ui/dom';
	import IconMoodSmile from '@tabler/icons-svelte/dist/svelte/icons/IconMoodSmile.svelte';
	import { customEmojiTags } from '../../stores/CustomEmojis';

	let button: HTMLButtonElement;
	let emojiPicker: HTMLElement;
	let hidden = true;

	const dispatch = createEventDispatcher();

	async function onClick() {
		hidden = !hidden;
		if (emojiPicker.children.length > 0) {
			return;
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
		const { Picker } = await import('emoji-kitchen-mart');
		const picker = new Picker({
			data,
			onEmojiSelect,
			onClickOutside: (event: PointerEvent) => {
				console.debug('[emoji picker outside]', event.target);
				if ((event.target as HTMLElement).closest('.emoji-picker') === null) {
					hidden = true;
				}
			},
			custom: [
				{
					id: 'default',
					name: 'Default',
					emojis: [
						{
							id: '+',
							name: 'Heart',
							keywords: ['+', 'heart', 'favorite', 'default'],
							skins: [
								{
									native: '+',
									src: 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/2764.png'
								}
							]
						}
					]
				},
				{
					id: 'custom-emoji',
					name: 'Custom Emojis',
					emojis: customEmojis
				}
			]
		});
		emojiPicker.appendChild(picker as any);

		// Position
		const { x, y } = await computePosition(button, emojiPicker, {
			placement: 'bottom',
			middleware: [flip(), shift()]
		});
		emojiPicker.style.left = `${x}px`;
		emojiPicker.style.top = `${y}px`;
	}

	function onEmojiSelect(emoji: BaseEmoji) {
		console.debug('[emoji picker selected]', emoji);
		dispatch('pick', emoji);
		hidden = true;
	}
</script>

<button on:click={onClick} bind:this={button} class="clear emoji-picker">
	<slot>
		<IconMoodSmile size={20} />
	</slot>
</button>
<div
	bind:this={emojiPicker}
	class:hidden
	on:keyup|stopPropagation={console.debug}
	class="emoji-picker"
/>

<style>
	button {
		color: var(--accent-gray);
		height: 20px;
	}

	div {
		position: absolute;
		z-index: 1;
	}

	div.hidden {
		visibility: hidden;
	}
</style>
