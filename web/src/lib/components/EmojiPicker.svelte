<script lang="ts" module>
	export let emojiPickerOpen = false;
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { BaseEmoji } from 'emoji-mart';
	import data from '@emoji-mart/data';
	import IconMoodSmile from '@tabler/icons-svelte-runes/icons/mood-smile';
	import { customEmojiTags } from '../author/CustomEmojis';
	import { _ } from 'svelte-i18n';
	import { Popover } from 'melt/builders';

	interface Props {
		containsDefaultEmoji?: boolean;
		autoClose?: boolean;
		children?: import('svelte').Snippet;
		inEditor?: boolean;
	}

	let {
		containsDefaultEmoji = true,
		autoClose = true,
		children,
		inEditor = false
	}: Props = $props();

	let emojiPicker: HTMLElement | undefined | null = $state();

	const popover = new Popover({
		onOpenChange: (open) => {
			console.debug('[emoji picker open]', open);
			if (open) {
				init();
			} else {
				clear();
			}
		}
	});

	const dispatch = createEventDispatcher();

	async function init(): Promise<void> {
		console.debug('[emoji picker click]', emojiPicker);
		if (!emojiPicker || emojiPicker.firstChild !== null) {
			return;
		}

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
		// eslint-disable-next-line svelte/no-dom-manipulating, @typescript-eslint/no-explicit-any
		emojiPicker.appendChild(picker as any);
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
		console.debug('[emoji picker clear]');
		emojiPicker?.firstChild?.remove();
		emojiPickerOpen = false;
	}
</script>

<button
	class="clear"
	class:editor-option={inEditor}
	class:active={inEditor}
	title={$_('emoji.title')}
	{...popover.trigger}
>
	{#if children}
		{@render children()}
	{:else}
		<IconMoodSmile size={20} />
	{/if}
</button>
<!-- Outside div is the workaround for .options height -->
<div>
	<div {...popover.content}>
		<div {...popover.arrow}></div>
		<main bind:this={emojiPicker}></main>
	</div>
</div>

<style>
	button:not(.editor-option) {
		color: var(--accent-gray);
	}

	[popover] {
		background-color: transparent;
	}

	main {
		border: var(--default-border);
		border-radius: var(--radius);
	}
</style>
