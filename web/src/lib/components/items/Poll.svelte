<script lang="ts">
	import type { Item } from '$lib/Items';
	import { _ } from 'svelte-i18n';
	import Content from '../Content.svelte';
	import EventMetadata from '../EventMetadata.svelte';
	import ExternalLink from '../ExternalLink.svelte';
	import { nip19 } from 'nostr-tools';
	import { vote } from '$lib/Poll';

	export let item: Item;
	export let createdAtFormat: 'auto' | 'time' = 'auto';

	$: optionTags = item.event.tags.filter(([tagName]) => tagName === 'option');
	$: relays = item.event.tags
		.filter(([tagName]) => tagName === 'relay')
		.map(([, tagContent]) => tagContent);
	$: type =
		item.event.tags
			.filter(([tagName]) => tagName === 'polltype')
			.at(0)
			?.at(1) ?? 'singlechoice';
	$: endsAt = item.event.tags
		.filter(([tagName]) => tagName === 'endsAt')
		.at(0)
		?.at(1);

	let selected: string | string[] | undefined;
	let voted = false;
	$: optionIds = !selected ? [] : Array.isArray(selected) ? selected : [selected];
	$: ended = endsAt === undefined || Date.now() > new Date(Number(endsAt) * 1000).getTime();
	$: votable = !ended && optionIds.length > 0 && !voted;

	$: nevent = nip19.neventEncode({
		id: item.event.id,
		author: item.event.pubkey,
		relays: relays.length > 0 ? relays : undefined
	});

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
	<section slot="content">
		<Content content={item.event.content} tags={item.event.tags} />
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<form on:submit={onSubmit} on:mouseup|stopPropagation>
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
</EventMetadata>

<style>
	form > div {
		margin: 0.5rem;
	}

	input[type='submit']:disabled {
		opacity: 50%;
	}
</style>
