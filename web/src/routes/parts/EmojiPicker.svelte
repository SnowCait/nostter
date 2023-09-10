<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Picker } from 'emoji-mart';
	import type { BaseEmoji } from '@types/emoji-mart';
	import data from '@emoji-mart/data';
	import { computePosition, flip, shift } from '@floating-ui/dom';
	import IconMoodSmile from '@tabler/icons-svelte/dist/svelte/icons/IconMoodSmile.svelte';

	let button: HTMLButtonElement;
	let emojiPicker: HTMLElement;
	let hidden = true;

	const dispatch = createEventDispatcher();

	async function onClick() {
		hidden = !hidden;
		if (emojiPicker.children.length > 0) {
			return;
		}
		const picker = new Picker({
			data,
			onEmojiSelect,
			onClickOutside: (event: PointerEvent) => {
				console.debug('[emoji picker outside]', event.target);
				if ((event.target as HTMLElement).closest('.emoji-picker') === null) {
					hidden = true;
				}
			}
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
		console.log('[emoji reaction selected]', emoji);
		dispatch('pick', emoji);
		hidden = true;
	}
</script>

<button on:click={onClick} bind:this={button} class="clear emoji-picker">
	<IconMoodSmile size={20} />
</button>
<div bind:this={emojiPicker} class:hidden />

<style>
	button {
		color: lightgray;
		height: 20px;
	}

	div {
		position: absolute;
	}

	div.hidden {
		visibility: hidden;
	}
</style>
