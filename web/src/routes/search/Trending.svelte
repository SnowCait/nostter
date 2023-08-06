<script lang="ts">
	import { createRxForwardReq, createRxNostr } from 'rx-nostr';
	import { onMount } from 'svelte';

	let phrases: Phrase[] = [];

	const relays = ['wss://nostrbuzzs-relay.fly.dev/'];
	const rxNostr = createRxNostr();

	onMount(async () => {
		console.log('[trend page]');
		await rxNostr.switchRelays(relays);
		console.log('[trend]', 1);
		const rxReq = createRxForwardReq();
		console.log('[trend]', 2);
		const observable = rxNostr.use(rxReq);
		console.log('[trend]', 3);
		observable.subscribe(({ from, subId, event }) => {
			console.log('[trend]', from, subId, event);
			const buzz: Buzz = JSON.parse(event.content);
			phrases = buzz.phrases;
		});

		rxReq.emit({ limit: 1 });
	});

	interface Phrase {
		text: string;
	}

	interface Buzz {
		phrases: Phrase[];
	}
</script>

<h2>Trending</h2>

<ul class="clear">
	{#each phrases as { text }}
		<li>
			<a href="/search?q={text}">{text}</a>
		</li>
	{/each}
</ul>

<style>
	li + li {
		margin-top: 0.5rem;
	}
</style>
