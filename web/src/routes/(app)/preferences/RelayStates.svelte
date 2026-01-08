<script lang="ts">
	import ConnectionStates from '$lib/components/ConnectionStates.svelte';
	import { _ } from 'svelte-i18n';
</script>

<h3>{$_('relay.connection.states')}</h3>
<ConnectionStates />
