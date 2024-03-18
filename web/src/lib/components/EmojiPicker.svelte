<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import type { BaseEmoji } from '@types/emoji-mart';
	import data from '@emoji-mart/data';
	import { autoUpdate, computePosition, shift } from '@floating-ui/dom';
	import IconMoodSmile from '@tabler/icons-svelte/dist/svelte/icons/IconMoodSmile.svelte';
	import { customEmojiTags } from '../author/CustomEmojis';

	let button: HTMLButtonElement | undefined;
	let emojiPicker: HTMLElement | undefined;
	let hidden = true;
	let stopAutoUpdate: (() => void) | undefined;

	const dispatch = createEventDispatcher();

	async function onClick(): Promise<void> {
		console.debug(
			'[emoji picker click]',
			emojiPicker,
			typeof ResizeObserver,
			typeof IntersectionObserver,
			button?.getBoundingClientRect(),
			document.documentElement.ownerDocument
		);
		if (button === undefined || emojiPicker === undefined || !hidden) {
			return;
		}
		hidden = false;
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
			onClickOutside,
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
		console.debug('[emoji picker children]', emojiPicker.children);
		stopAutoUpdate = autoUpdate(button, emojiPicker, render);
	}

	async function render(): Promise<void> {
		console.debug('[emoji picker render]', emojiPicker?.children);
		if (button === undefined || emojiPicker === undefined) {
			return;
		}

		await tick();

		const { x, y } = await computePosition(button, emojiPicker, {
			placement: 'bottom',
			middleware: [shift()]
		});
		emojiPicker.style.left = `${x}px`;
		emojiPicker.style.top = `${y}px`;
	}

	function onClickOutside(event: PointerEvent): void {
		if ((event.target as HTMLElement).closest('.emoji-picker') === null) {
			hidden = true;
			clear();
		}
	}

	function onEmojiSelect(emoji: BaseEmoji): void {
		console.debug('[emoji picker selected]', emoji);
		dispatch('pick', emoji);
		hidden = true;
		clear();
	}

	function clear(): void {
		emojiPicker?.firstChild?.remove();
		stopAutoUpdate?.();
	}
</script>

<button on:click={onClick} bind:this={button} class="clear">
	<slot>
		<IconMoodSmile size={20} />
	</slot>
</button>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={emojiPicker} class:hidden on:keyup|stopPropagation class="emoji-picker" />

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
