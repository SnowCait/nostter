<script lang="ts">
	export let slug: string;
	export let date: Date;
</script>

<a
	href="/{slug}/{date.getFullYear()}/{(date.getMonth() + 1).toString().padStart(2, '0')}/{date
		.getDate()
		.toString()
		.padStart(2, '0')}"
>
	<slot />
</a>

<style>
	a {
		text-decoration: underline;
	}
</style>
