<script lang="ts">
	export let query: string;
</script>

<form action="/search">
	<input type="search" name="q" value={query} on:keyup|stopPropagation={() => console.debug} />
	<input type="submit" value="Search" />
</form>
