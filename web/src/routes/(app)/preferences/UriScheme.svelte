<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { page } from '$app/stores';
	import { uriScheme } from '$lib/Constants';

	function enableUriScheme() {
		console.log('[uri scheme enable]');
		navigator.registerProtocolHandler(uriScheme, `${$page.url.origin}/%s`);
	}
</script>

<span>{$_('preferences.uri_scheme')}</span><button on:click={enableUriScheme}>{$_('preferences.enable_uri_scheme')}</button>
