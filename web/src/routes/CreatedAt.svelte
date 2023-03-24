<script lang="ts">
	export let createdAt: number;
	export let format: 'auto' | 'time' = 'auto';

	const date = new Date(createdAt * 1000);
	const elapsedTime = Date.now() - date.getTime();
	const oneDay = 24 * 60 * 60 * 1000;
	let createdAtDisplay: string;
	if (elapsedTime < oneDay || format === 'time') {
		createdAtDisplay = date.toLocaleTimeString('ja-JP', {
			hour: 'numeric',
			minute: '2-digit'
		});
	} else if (elapsedTime < 30 * oneDay) {
		createdAtDisplay = date.toLocaleDateString('ja-JP', {
			month: 'numeric',
			day: 'numeric'
		});
	} else {
		createdAtDisplay = date.toLocaleDateString('ja-JP', {
			year: 'numeric',
			month: 'numeric'
		});
	}
</script>

<span>{createdAtDisplay}</span>

<style>
	span {
		color: gray;
		font-size: 0.5em;
	}
</style>
