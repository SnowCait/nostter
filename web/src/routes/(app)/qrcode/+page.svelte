<script lang="ts">
	import { _ } from 'svelte-i18n';
	import QrCodeScanner from '$lib/components/QRCodeScanner.svelte';
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1>{$_('qrcode.scan')}</h1>
<QrCodeScanner />
