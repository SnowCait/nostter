<script lang="ts" context="module">
	export let emojiPickerOpen = false;
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { BaseEmoji } from '@types/emoji-mart';
	import data from '@emoji-mart/data';
	import { autoUpdate, computePosition, shift } from '@floating-ui/dom';
	import IconMoodSmile from '@tabler/icons-svelte/icons/mood-smile';
	import { customEmojiTags } from '../author/CustomEmojis';

	export let containsDefaultEmoji = true;
	export let autoClose = true;

	let button: HTMLButtonElement | undefined;
	let emojiPicker: HTMLElement | undefined | null;
	let stopAutoUpdate: (() => void) | undefined;

	const dispatch = createEventDispatcher();

	async function onClick(e: MouseEvent): Promise<void> {
		console.debug('[emoji picker click]', emojiPicker);
		if (button === undefined || !emojiPicker || emojiPicker.firstChild !== null) {
			return;
		}

		e.stopPropagation();
		emojiPickerOpen = true;

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

		const custom = [];
		if (containsDefaultEmoji) {
			custom.push({
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
			});
		}
		if (customEmojis.length > 0) {
			custom.push({
				id: 'custom-emoji',
				name: 'Custom Emojis',
				emojis: customEmojis
			});
		}

		const { Picker } = await import('emoji-kitchen-mart');
		const picker = new Picker({
			data,
			onEmojiSelect,
			onClickOutside,
			custom
		});
		emojiPicker.appendChild(picker as any);
		console.debug('[emoji picker child]', emojiPicker.firstChild);
		stopAutoUpdate = autoUpdate(button, emojiPicker, render);
	}

	async function render(): Promise<void> {
		console.debug('[emoji picker render]', emojiPicker?.firstChild);
		if (button === undefined || !emojiPicker || emojiPicker.firstChild === null) {
			return;
		}

		const { x, y } = await computePosition(button, emojiPicker, {
			placement: 'bottom',
			middleware: [shift()]
		});
		emojiPicker.style.left = `${x}px`;
		emojiPicker.style.top = `${y}px`;
	}

	function onClickOutside(event: PointerEvent) {
		console.debug('[emoji picker outside]', event.target);
		clear();
	}

	function onEmojiSelect(emoji: BaseEmoji): void {
		console.debug('[emoji picker selected]', emoji);
		dispatch('pick', emoji);
		if (autoClose) {
			clear();
		}
	}

	function clear(): void {
		stopAutoUpdate?.();
		emojiPicker?.firstChild?.remove();
		emojiPickerOpen = false;
	}
</script>

<button on:click={onClick} bind:this={button} class="clear">
	<slot>
		<IconMoodSmile size={20} />
	</slot>
</button>
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div bind:this={emojiPicker} on:keyup|stopPropagation class="emoji-picker" />

<style>
	button {
		color: var(--accent-gray);
		height: 20px;
	}

	div {
		position: absolute;
		z-index: 1;
	}
</style>
