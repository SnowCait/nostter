<script lang="ts">
	import { createBubbler, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import type { Item } from '$lib/Items';
	import { _ } from 'svelte-i18n';
	import Content from '../Content.svelte';
	import EventMetadata from '../EventMetadata.svelte';
	import ExternalLink from '../ExternalLink.svelte';
	import { nip19 } from 'nostr-tools';
	import { vote } from '$lib/Poll';

	interface Props {
		item: Item;
		createdAtFormat?: 'auto' | 'time';
	}

	let { item, createdAtFormat = 'auto' }: Props = $props();

	let optionTags = $derived(item.event.tags.filter(([tagName]) => tagName === 'option'));
	let relays = $derived(
		item.event.tags
			.filter(([tagName]) => tagName === 'relay')
			.map(([, tagContent]) => tagContent)
	);
	let type = $derived(
		item.event.tags
			.filter(([tagName]) => tagName === 'polltype')
			.at(0)
			?.at(1) ?? 'singlechoice'
	);
	let endsAt = $derived(
		item.event.tags
			.filter(([tagName]) => tagName === 'endsAt')
			.at(0)
			?.at(1)
	);

	let selected: string | string[] | undefined = $state();
	let voted = $state(false);
	let optionIds = $derived(!selected ? [] : Array.isArray(selected) ? selected : [selected]);
	let ended = $derived(
		endsAt === undefined || Date.now() > new Date(Number(endsAt) * 1000).getTime()
	);
	let votable = $derived(!ended && optionIds.length > 0 && !voted);

	let nevent = $derived(
		nip19.neventEncode({
			id: item.event.id,
			relays: relays.length > 0 ? relays : undefined,
			author: item.event.pubkey,
			kind: item.event.kind
		})
	);

	function onSubmit(e: SubmitEvent): void {
		e.preventDefault();

		if (!votable) {
			return;
		}

		voted = true; // Simplified version
		vote(item.event.id, optionIds, relays);
	}
</script>

<EventMetadata {item} {createdAtFormat}>
	{#snippet content()}
		<section>
			<Content content={item.event.content} tags={item.event.tags} />
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<form onsubmit={onSubmit} onmouseup={stopPropagation(bubble('mouseup'))}>
				<div>
					{#each optionTags as [, id, label]}
						<div>
							<label>
								{#if type === 'multiplechoice'}
									<input type="checkbox" bind:group={selected} value={id} />
								{:else}
									<input type="radio" bind:group={selected} value={id} />
								{/if}
								<span>{label}</span>
							</label>
						</div>
					{/each}
				</div>
				<div>
					<input type="submit" value={$_('poll.vote')} disabled={!votable} />
					{#if endsAt}
						<span>
							{$_('poll.ends_at').replace(
								'%s',
								new Date(Number(endsAt) * 1000).toLocaleString()
							)}
						</span>
					{/if}
				</div>
				<div>
					<ExternalLink link={new URL(`https://nos-haiku.vercel.app/entry/${nevent}`)}>
						{$_('poll.result')}
					</ExternalLink>
				</div>
			</form>
		</section>
	{/snippet}
</EventMetadata>

<style>
	form > div {
		margin: 0.5rem;
	}

	input[type='submit']:disabled {
		opacity: 50%;
	}
</style>
