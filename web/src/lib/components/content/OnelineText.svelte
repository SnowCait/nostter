<script lang="ts">
	interface Props {
		text: string;
	}

	let { text }: Props = $props();
</script>

<span>{text}</span>

<style>
	span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
