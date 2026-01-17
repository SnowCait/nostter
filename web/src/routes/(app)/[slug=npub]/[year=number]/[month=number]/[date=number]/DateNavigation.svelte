<script lang="ts">
	import DateLink from '$lib/components/DateLink.svelte';
	import IconChevronLeft from '@tabler/icons-svelte/icons/chevron-left';
	import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right';

	interface Props {
		slug: string;
		date: Date;
	}

	let { slug, date }: Props = $props();

	let previous = $derived(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
	let next = $derived(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
</script>

<nav>
	<span>
		<DateLink {slug} date={previous}>
			<IconChevronLeft />
		</DateLink>
	</span>

	<h1>{date.toLocaleDateString()}</h1>

	<span>
		<DateLink {slug} date={next}>
			<IconChevronRight />
		</DateLink>
	</span>
</nav>

<style>
	nav {
		display: flex;
		justify-content: space-between;
		margin: 0.5rem auto;
	}

	span {
		margin-top: auto;
	}
</style>
