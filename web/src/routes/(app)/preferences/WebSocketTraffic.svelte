<script lang="ts">
	import { onMount } from 'svelte';
	import { _, locale } from 'svelte-i18n';
	import type { WebSocketMetricsSnapshot, WebSocketTrafficMetrics } from 'websocket-metrics';
	import { metrics } from '$lib/platform/browser/websocket-metrics';
	import { getDefaultReadRelays } from '$lib/RxNostrHelper';
	import { formatBytes } from './format-bytes';

	let snapshot = $state.raw<WebSocketMetricsSnapshot>({
		total: {
			received: { bytes: 0, messages: 0 },
			sent: { bytes: 0, messages: 0 }
		},
		byKey: {}
	});
	const urls = $derived(
		Object.entries(snapshot.byKey)
			.sort(
				([a, x], [b, y]) =>
					y.received.bytes + y.sent.bytes - (x.received.bytes + x.sent.bytes) ||
					a.localeCompare(b)
			)
			.map(([url]) => url)
	);
	const relays = $derived.by(() => {
		const readRelays = new Set(getDefaultReadRelays());
		return {
			subscribed: urls.filter((url) => readRelays.has(url)),
			others: urls.filter((url) => !readRelays.has(url))
		};
	});

	onMount(() => metrics?.subscribe((current) => (snapshot = current)));
</script>

{#snippet counts(traffic: WebSocketTrafficMetrics)}
	<dl>
		<dt>{$_('preferences.websocket_traffic.received')}</dt>
		<dd>
			{formatBytes(traffic.received.bytes, $locale ?? 'en')} /
			{$_('preferences.websocket_traffic.messages', {
				values: { count: traffic.received.messages }
			})}
		</dd>
		<dt>{$_('preferences.websocket_traffic.sent')}</dt>
		<dd>
			{formatBytes(traffic.sent.bytes, $locale ?? 'en')} /
			{$_('preferences.websocket_traffic.messages', {
				values: { count: traffic.sent.messages }
			})}
		</dd>
	</dl>
{/snippet}

<h3>{$_('preferences.websocket_traffic.title')}</h3>
<p>{$_('preferences.websocket_traffic.description')}</p>
<h4>{$_('preferences.websocket_traffic.total')}</h4>
{@render counts(snapshot.total)}

{#if urls.length === 0}
	<p>{$_('preferences.websocket_traffic.empty')}</p>
{/if}

{#each relays.subscribed as url (url)}
	<h4 class="url">{url}</h4>
	{@render counts(snapshot.byKey[url])}
{/each}

{#if relays.others.length > 0}
	<details>
		<summary>
			{$_('preferences.websocket_traffic.other_relays', {
				values: { count: relays.others.length }
			})}
		</summary>
		{#each relays.others as url (url)}
			<h4 class="url">{url}</h4>
			{@render counts(snapshot.byKey[url])}
		{/each}
	</details>
{/if}

<style>
	h4 {
		margin-top: 1rem;
	}

	.url {
		overflow-wrap: anywhere;
		font-family: monospace;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
		margin-top: 0.5rem;
	}

	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
</style>
