<script lang="ts">
	export let text: string;
</script>

<span>{text}</span>

<style>
	span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
