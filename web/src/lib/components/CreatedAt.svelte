<script lang="ts">
	import { browser } from '$app/environment';

	export let createdAt: number;
	export let format: 'auto' | 'time' = 'auto';

	const lang = browser ? navigator.language : 'en';
	const date = new Date(createdAt * 1000);
	const elapsedTime = Date.now() - date.getTime();
	const oneDay = 24 * 60 * 60 * 1000;
	let createdAtDisplay: string;
	if (elapsedTime < oneDay || format === 'time') {
		createdAtDisplay = date.toLocaleTimeString(lang, {
			hour: 'numeric',
			minute: '2-digit'
		});
	} else if (elapsedTime < 365 * oneDay) {
		createdAtDisplay = date.toLocaleDateString(lang, {
			month: 'numeric',
			day: 'numeric'
		});
	} else {
		createdAtDisplay = date.toLocaleDateString(lang, {
			year: 'numeric',
			month: 'numeric'
		});
	}
</script>

<span title={date.toLocaleString()}>{createdAtDisplay}</span>

<style>
	span {
		color: gray;
		font-size: 0.7em;
	}
</style>
