<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { uriScheme } from '$lib/Constants';

	function enableUriScheme() {
		console.log('[uri scheme enable]');
		navigator.registerProtocolHandler(uriScheme, `${page.url.origin}/%s`);
	}
</script>

{#if browser && navigator.registerProtocolHandler !== undefined}
	<span>{$_('preferences.uri_scheme')}</span>
	<button onclick={enableUriScheme}>{$_('preferences.enable_uri_scheme')}</button>
{/if}
