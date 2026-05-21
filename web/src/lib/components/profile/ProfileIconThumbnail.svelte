<script lang="ts">
	import { Dialog } from 'melt/builders';
	import ProfileIcon from './ProfileIcon.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	const dialog = new Dialog();
</script>

<button {...dialog.trigger} class="clear">
	<ProfileIcon {pubkey} />
</button>

<dialog {...dialog.content} class="media-dialog">
	<ProfileIcon {pubkey} width="auto" height="auto" />
</dialog>

<style>
	button {
		width: 100%;
		height: 100%;
	}

	dialog :global(img) {
		max-width: 60vw;
		max-height: 60vh;
		border-radius: 0;
		object-fit: contain;
	}
</style>
