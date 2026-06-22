<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { seenOnRelayIcon } from '$lib/SeenOnRelayIcon';
</script>

<label>
	<input type="checkbox" bind:checked={$seenOnRelayIcon} />
	<span>{$_('preferences.seen_on_relay_icon')}</span>
</label>
