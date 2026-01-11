<script lang="ts">
	interface Props {
		object: any;
	}

	let { object }: Props = $props();
</script>

<code>{JSON.stringify(object, null, 2)}</code>

<style>
	code {
		max-height: 20rem;
		margin: 1rem auto;
	}
</style>
