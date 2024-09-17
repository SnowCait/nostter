<script lang="ts">
	import { _ } from 'svelte-i18n';
	import QrCodeScanner from '$lib/components/QRCodeScanner.svelte';
</script>

<h1>{$_('qrcode.scan')}</h1>
<QrCodeScanner />
