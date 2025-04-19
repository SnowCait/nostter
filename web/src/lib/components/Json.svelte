<script lang="ts">
	export let object: any; // eslint-disable-line @typescript-eslint/no-explicit-any
</script>

<code>{JSON.stringify(object, null, 2)}</code>

<style>
	code {
		max-height: 20rem;
		margin: 1rem auto;
	}
</style>
