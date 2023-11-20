<script lang="ts">
	import { createRxNostr, createRxOneshotReq } from 'rx-nostr';
	import { trendRelays } from '$lib/Constants';

	let phrases: Phrase[] = [];

	console.log('[trend]', trendRelays);
	const rxNostr = createRxNostr();
	rxNostr.switchRelays(trendRelays).then(() => {
		const rxReq = createRxOneshotReq({
			filters: { kinds: [38225], '#d': ['buzz-phrases:ja'], limit: 1 }
		});
		const subscription = rxNostr.use(rxReq).subscribe((packet) => {
			console.log('[rx-nostr trend packet]', packet);
			subscription.unsubscribe();
			rxNostr.dispose();
			const buzz = JSON.parse(packet.event.content) as Buzz;
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

	a {
		text-decoration: underline;
	}

	li + li {
		margin-top: 0.5rem;
	}
</style>
