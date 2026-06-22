<script lang="ts">
	import { Nip11Registry } from 'rx-nostr';
	import { hostname } from '$lib/Helper';

	interface Props {
		relay: string;
	}

	let { relay }: Props = $props();

	let host = $derived(hostname(relay));
	let initial = $derived(host.charAt(0).toUpperCase());

	let triedFavicon = $state(false);
	let failed = $state(false);

	function favicon(): string {
		return `https://${host}/favicon.ico`;
	}

	function onError(event: Event): void {
		const img = event.currentTarget as HTMLImageElement;
		if (!triedFavicon && img.src !== favicon()) {
			triedFavicon = true;
			img.src = favicon();
		} else {
			failed = true;
		}
	}
</script>

{#await Nip11Registry.getOrFetch(relay) then info}
	{#if failed}
		<span class="placeholder">{initial}</span>
	{:else}
		<img src={info.icon || favicon()} alt={host} onerror={onError} />
	{/if}
{/await}

<style>
	img,
	.placeholder {
		display: block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
	}

	img {
		object-fit: cover;
	}

	.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--accent-gray);
		color: white;
		font-size: 10px;
		line-height: 1;
		text-transform: uppercase;
	}
</style>
