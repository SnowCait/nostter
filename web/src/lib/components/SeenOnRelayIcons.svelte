<script lang="ts">
	import { Nip11Registry } from 'rx-nostr';
	import { getSeenOnRelays } from '$lib/timelines/MainTimeline';

	interface Props {
		id: string;
	}

	let { id }: Props = $props();

	let relays = $derived(getSeenOnRelays(id) ?? []);

	function hostname(relay: string): string {
		try {
			return new URL(relay).hostname;
		} catch {
			return relay;
		}
	}

	function favicon(relay: string): string {
		return `https://${hostname(relay)}/favicon.ico`;
	}

	function onError(event: Event, relay: string): void {
		const img = event.currentTarget as HTMLImageElement;
		const fallback = favicon(relay);
		if (img.src !== fallback) {
			img.src = fallback;
		} else {
			img.style.visibility = 'hidden';
		}
	}
</script>

<div class="relays">
	{#each relays as relay (relay)}
		<a href="/relays/{encodeURIComponent(relay)}" title={hostname(relay)}>
			{#await Nip11Registry.getOrFetch(relay) then info}
				<img
					src={info.icon || favicon(relay)}
					alt={hostname(relay)}
					onerror={(event) => onError(event, relay)}
				/>
			{:catch}
				<img
					src={favicon(relay)}
					alt={hostname(relay)}
					onerror={(event) => onError(event, relay)}
				/>
			{/await}
		</a>
	{/each}
</div>

<style>
	.relays {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
	}

	img {
		display: block;
		width: 16px;
		height: 16px;
		border-radius: 2px;
		object-fit: cover;
	}
</style>
