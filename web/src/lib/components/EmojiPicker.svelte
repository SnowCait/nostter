<script lang="ts" module>
	export let emojiPickerOpen = false;
</script>

<script lang="ts">
	import { createBubbler, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import { createEventDispatcher } from 'svelte';
	import type { BaseEmoji } from '@types/emoji-mart';
	import data from '@emoji-mart/data';
	import { autoUpdate, computePosition, shift } from '@floating-ui/dom';
	import IconMoodSmile from '@tabler/icons-svelte/icons/mood-smile';
	import { customEmojiTags } from '../author/CustomEmojis';

	interface Props {
		containsDefaultEmoji?: boolean;
		autoClose?: boolean;
		children?: import('svelte').Snippet;
	}

	let { containsDefaultEmoji = true, autoClose = true, children }: Props = $props();

	let button: HTMLButtonElement | undefined = $state();
	let emojiPicker: HTMLElement | undefined | null = $state();
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
		emojiPicker.appendChild(picker as any); // eslint-disable-line @typescript-eslint/no-explicit-any
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

<button onclick={onClick} bind:this={button} class="clear">
	{#if children}{@render children()}{:else}
		<IconMoodSmile size={20} />
	{/if}
</button>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={emojiPicker} onkeyup={stopPropagation(bubble('keyup'))} class="emoji-picker"></div>

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
