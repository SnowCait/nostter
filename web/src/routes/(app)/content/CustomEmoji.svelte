<script lang="ts">
	export let text: string = '';
	export let url: string;
</script>

<img src={url} alt={text} title={text} />

<style>
	img {
		max-height: 1.5em;
		vertical-align: top;
	}
</style>
