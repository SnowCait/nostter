<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { developerMode } from '../../../stores/Preference';
</script>

<label>
	<input type="checkbox" bind:value={$developerMode} />
	<span>{$_('preferences.developer_mode')}</span>
</label>
