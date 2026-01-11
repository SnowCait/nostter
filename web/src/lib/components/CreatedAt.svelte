<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		createdAt: number;
		format?: 'auto' | 'time' | 'full';
	}

	let { createdAt, format = 'auto' }: Props = $props();

	const lang = browser ? navigator.language : 'en';
	const date = new Date(createdAt * 1000);
	const elapsedTime = Date.now() - date.getTime();
	const oneDay = 24 * 60 * 60 * 1000;
	let createdAtDisplay: string = $state();
	if (format === 'full') {
		createdAtDisplay = date.toLocaleString(lang);
	} else if (elapsedTime < oneDay || format === 'time') {
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

<span title={date.toLocaleString(lang)} class:full={format === 'full'}>
	{createdAtDisplay}
</span>

<style>
	span {
		color: var(--accent-gray);
		font-size: 0.7rem;
	}

	span.full {
		font-size: 1rem;
	}
</style>
