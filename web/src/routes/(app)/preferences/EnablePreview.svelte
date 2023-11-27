<script lang="ts">
	import { browser } from '$app/environment';
	import { WebStorage } from '$lib/WebStorage';
	import { enablePreview } from '../../../stores/Preference';

	if (browser) {
		enablePreview.subscribe((value) => {
			const storage = new WebStorage(localStorage);
			storage.set('preference:preview', JSON.stringify(value));
		});
	}
</script>

<label>
	<input type="checkbox" bind:checked={$enablePreview} />
	<span>Enable preview</span>
</label>
