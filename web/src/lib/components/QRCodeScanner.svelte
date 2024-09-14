<script lang="ts">
	import { onMount } from 'svelte';
	import { Html5QrcodeScanner } from 'html5-qrcode';
	import { goto } from '$app/navigation';

	onMount(() => {
		const scanner = new Html5QrcodeScanner(
			'scanner',
			{
				fps: 10,
				qrbox: { width: 250, height: 250 }
			},
			false
		);
		scanner.render(async (text: string) => {
			console.log('[qrcode scanner]', text);
			if (text.startsWith('nostr:npub1') || text.startsWith('nostr:nprofile1')) {
				scanner.pause(true);
				await goto(`/${text.substring('nostr:'.length)}`);
			}
		}, undefined);
	});
</script>

<div id="scanner"></div>
