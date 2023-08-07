<script lang="ts">
	import { createRxNostr, createRxOneshotReq } from 'rx-nostr';
	import { onMount } from 'svelte';

	let phrases: Phrase[] = [];

	const relays = ['wss://nostrbuzzs-relay.fly.dev/'];
	const rxNostr = createRxNostr();

	onMount(async () => {
		console.log('[trend page]');
		await rxNostr.switchRelays(relays);
		const rxReq = createRxOneshotReq({
			filters: { kinds: [38225], '#d': ['buzz-phrases:ja'], limit: 1 }
		});
		const observable = rxNostr.use(rxReq);
		const subscription = observable.subscribe(({ from, subId, event }) => {
			console.log('[trend]', from, subId, event);
			subscription.unsubscribe();
			rxNostr.dispose();
			const buzz: Buzz = JSON.parse(event.content);
			phrases = buzz.phrases;
		});
	});

	interface Phrase {
		text: string;
	}

	interface Buzz {
		phrases: Phrase[];
	}
</script>

<h2>
	<span>Trending</span>
	<nav>
		<span>by</span>
		<a href="https://nostrbuzzs.deno.dev/" target="_blank" rel="noreferrer noopener">
			nostrbuzzs
		</a>
	</nav>
</h2>

<ul class="clear">
	{#each phrases as { text }}
		<li>
			<a href="/search?q={text}">{text}</a>
		</li>
	{/each}
</ul>

<style>
	nav {
		display: inline;
		font-size: 0.8rem;
	}

	li + li {
		margin-top: 0.5rem;
	}
</style>
