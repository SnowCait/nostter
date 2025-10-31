<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

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
	<span>{$_('notifications.toast.title')}</span>
	<button on:click={requestPermission}>{$_('notifications.toast.enable')}</button>
{/if}
