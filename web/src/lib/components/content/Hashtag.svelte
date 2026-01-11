<script lang="ts">
	interface Props {
		text: string;
	}

	let { text }: Props = $props();
</script>

<a href="/search?q={encodeURIComponent(`${text}`)}">{text}</a>
{#if /^#[0-9a-fA-F]{6}$/.test(text)}
	<span style="background-color: {text};"></span>
{/if}

<style>
	span {
		border: var(--default-border);
		border-radius: 50%;
		width: 1rem;
		height: 1rem;
		display: inline-block;
		vertical-align: text-bottom;
	}
</style>
