<script lang="ts">
	import { onMount } from 'svelte';

	let show = false;

	async function requestPermission() {
		await Notification.requestPermission();
		show = Notification.permission === 'default';
	}

	onMount(async () => {
		console.log('[Preference.onMount]');
		if (window.Notification !== undefined) {
			show = Notification.permission === 'default';
		}
	});
</script>

{#if show}
	<button on:click={requestPermission}>通知設定</button>
{/if}
