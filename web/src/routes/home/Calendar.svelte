<script lang="ts">
	import { goto } from '$app/navigation';

	const now = new Date();
	export let date = `${now.getFullYear()}-${('0' + (now.getMonth() + 1)).slice(-2)}-${(
		'0' + now.getDate()
	).slice(-2)}`;
	console.log(date);

	async function navigate() {
		const url = `/home/${date}`;
		console.log(`Redirect to ${url}`);
		await goto(url);
	}
</script>

<input type="date" bind:value={date} on:change={navigate} />
