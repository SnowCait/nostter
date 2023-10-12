<script lang="ts">
	import IconPhoto from '@tabler/icons-svelte/dist/svelte/icons/IconPhoto.svelte';

	export let mediaFiles: File[];

	let input: HTMLInputElement | undefined;
	let files: FileList;

	function upload() {
		console.log('[media upload]', files);
		for (const file of files) {
			console.log('[media upload file]', file);
			mediaFiles.push(file);
			mediaFiles = mediaFiles;
		}
	}
</script>

<button on:click={() => input?.click()} class="clear">
	<IconPhoto size="30" />
</button>
<input type="file" bind:this={input} bind:files on:change={upload} accept="image/*" hidden>

<style>
	button {
		color: var(--accent);
	}
</style>
