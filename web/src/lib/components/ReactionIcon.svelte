<script lang="ts">
	import IconHeart from '@tabler/icons-svelte/icons/heart';
	import IconHeartFilled from '@tabler/icons-svelte/icons/heart-filled';
	import IconPaw from '@tabler/icons-svelte/icons/paw';
	import IconPawFilled from '@tabler/icons-svelte/icons/paw-filled';
	import IconStar from '@tabler/icons-svelte/icons/star';
	import IconStarFilled from '@tabler/icons-svelte/icons/star-filled';

	export let defaultReaction: string;
	export let reactioned: boolean;
	export let isAprilFool: boolean;
	export let size: number = 24;
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
