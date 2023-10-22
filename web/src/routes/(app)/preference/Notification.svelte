<script lang="ts">
	import { onMount } from 'svelte';

	let show = false;

	async function requestPermission() {
		await Notification.requestPermission();
		show = Notification.permission === 'default';
	}

	onMount(async () => {
		if (window.Notification !== undefined) {
			show = Notification.permission === 'default';
		}
	});
</script>

{#if show}
	<span>Notification:</span>
	<button on:click={requestPermission}>Notification Setting</button>
{/if}
