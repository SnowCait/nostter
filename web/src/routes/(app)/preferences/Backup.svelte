<script lang="ts">
	import { run } from 'svelte/legacy';

	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import type { Event } from 'nostr-typedef';
	import { createCollapsible, melt } from '@melt-ui/svelte';
	import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down';
	import { eventCache } from '$lib/cache/Events';
	import { pubkey } from '$lib/stores/Author';
	import Loading from '$lib/components/Loading.svelte';
	import { hexRegexp } from '$lib/Constants';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { now } from 'rx-nostr';
	import { Signer } from '$lib/Signer';
	import { WebStorage } from '$lib/WebStorage';
	import { updateFolloweesStore } from '$lib/Contacts';

	let cachedEvents: Event[] = $state([]);
	let loading = $state(false);

	const {
		elements: { root, content, trigger },
		states: { open }
	} = createCollapsible();


	async function loadCachedVersions() {
		loading = true;
		const $pubkey = get(pubkey);
		if ($pubkey) {
			cachedEvents = await eventCache.getReplaceableEvents(3, $pubkey);
		}
		loading = false;
	}

	async function restore(oldEvent: Event): Promise<void> {
		if (!confirm($_('preferences.backup.confirm'))) {
			return;
		}
		const event = await Signer.signEvent({ ...oldEvent, created_at: now() });
		rxNostr.send(event);
		updateFolloweesStore(event.tags);
		const storage = new WebStorage(localStorage);
		storage.setReplaceableEvent(event);
		$open = false;
	}
	run(() => {
		if ($open) loadCachedVersions();
	});
</script>

<h3>{$_('preferences.backup.title')}</h3>

<div use:melt={$root} class="root">
	<button use:melt={$trigger} class="trigger">
		<span>{$_('preferences.backup.followees.list')}</span>
		<IconChevronDown size={20} class={$open ? 'open' : ''} />
	</button>

	{#if $open}
		<div use:melt={$content} class="content">
			{#if loading}
				<Loading />
			{:else if cachedEvents.length === 0}
				<p>{$_('preferences.backup.none')}</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>{$_('preferences.backup.date')}</th>
							<th>{$_('preferences.backup.followees.count')}</th>
							<th>{$_('preferences.backup.restore')}</th>
						</tr>
					</thead>
					<tbody>
						{#each cachedEvents as event, i (event.id)}
							<tr>
								<td>{new Date(event.created_at * 1000).toLocaleString()}</td>
								<td>
									{event.tags.filter(
										(tag) => tag[0] == 'p' && hexRegexp.test(tag[1])
									).length}
								</td>
								<td>
									{#if i == 0}
										<span>{$_('preferences.backup.latest')}</span>
									{:else}
										<button type="button" onclick={() => restore(event)}>
											{$_('preferences.backup.restore')}
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>

<style>
	.trigger {
		border-radius: 10px;
	}

	.content {
		margin-top: 1rem;
	}

	th,
	td {
		text-align: center;
		height: 2rem;
	}
</style>
