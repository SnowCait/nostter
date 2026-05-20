<script lang="ts">
	import IconHeart from '@tabler/icons-svelte-runes/icons/heart';
	import IconHeartFilled from '@tabler/icons-svelte-runes/icons/heart-filled';
	import IconPaw from '@tabler/icons-svelte-runes/icons/paw';
	import IconPawFilled from '@tabler/icons-svelte-runes/icons/paw-filled';
	import IconStar from '@tabler/icons-svelte-runes/icons/star';
	import IconStarFilled from '@tabler/icons-svelte-runes/icons/star-filled';

	interface Props {
		defaultReaction: string;
		reactioned: boolean;
		isAprilFool: boolean;
		size?: number;
	}

	let { defaultReaction, reactioned, isAprilFool, size = 24 }: Props = $props();
</script>

{#if defaultReaction === '🐾' || isAprilFool}
	{#if reactioned}
		<IconPawFilled {size} />
	{:else}
		<IconPaw {size} />
	{/if}
{:else if defaultReaction === '⭐'}
	{#if reactioned}
		<IconStarFilled {size} />
	{:else}
		<IconStar {size} />
	{/if}
{:else if reactioned}
	<IconHeartFilled {size} />
{:else}
	<IconHeart {size} />
{/if}
