<script lang="ts">
	interface Props {
		slug: string;
		date: Date;
		children?: import('svelte').Snippet;
	}

	let { slug, date, children }: Props = $props();
</script>

<a
	href="/{slug}/{date.getFullYear()}/{(date.getMonth() + 1).toString().padStart(2, '0')}/{date
		.getDate()
		.toString()
		.padStart(2, '0')}"
>
	{@render children?.()}
</a>

<style>
	a {
		text-decoration: underline;
	}
</style>
