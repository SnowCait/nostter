<script lang="ts">
	interface Props {
		text?: string;
		url: string;
	}

	let { text = '', url }: Props = $props();
</script>

<img src={url} alt={text} title={text} />

<style>
	img {
		max-height: 1.5em;
		max-width: 100%;
		vertical-align: top;
	}
</style>
