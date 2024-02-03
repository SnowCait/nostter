<script lang="ts">
	import IconChevronLeft from '@tabler/icons-svelte/dist/svelte/icons/IconChevronLeft.svelte';
	import IconChevronRight from '@tabler/icons-svelte/dist/svelte/icons/IconChevronRight.svelte';

	export let slug: string;
	export let date: Date;

	$: previous = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
	$: next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
</script>

<nav>
	<a
		href="/{slug}/{previous.getFullYear()}/{(previous.getMonth() + 1)
			.toString()
			.padStart(2, '0')}/{previous.getDate().toString().padStart(2, '0')}"
	>
		<IconChevronLeft />
	</a>

	<h1>{date.toLocaleDateString()}</h1>

	<a
		href="/{slug}/{next.getFullYear()}/{(next.getMonth() + 1).toString().padStart(2, '0')}/{next
			.getDate()
			.toString()
			.padStart(2, '0')}"
	>
		<IconChevronRight />
	</a>
</nav>

<style>
	nav {
		display: flex;
		justify-content: space-between;
		margin: 0.5rem auto;
	}

	a {
		margin-top: auto;
	}
</style>
