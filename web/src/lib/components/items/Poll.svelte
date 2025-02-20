<script lang="ts">
	import type { Item } from '$lib/Items';
	import { _ } from 'svelte-i18n';
	import Content from '../Content.svelte';
	import EventMetadata from '../EventMetadata.svelte';
	import ExternalLink from '../ExternalLink.svelte';
	import { nip19 } from 'nostr-tools';

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
	$: nevent = nip19.neventEncode({
		id: item.event.id,
		author: item.event.pubkey,
		relays: relays.length > 0 ? relays : undefined
	});
</script>

<EventMetadata {item} {createdAtFormat}>
	<section slot="content">
		<Content content={item.event.content} tags={item.event.tags} />
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<form on:submit|preventDefault on:mouseup|stopPropagation>
			{#if ['singlechoice', 'multiplechoice'].includes(type)}
				{#each optionTags as [, id, value]}
					<div>
						<label>
							<input type="radio" name={item.event.id} value={id} disabled />
							<span>{value}</span>
						</label>
					</div>
				{/each}
			{/if}
			<ExternalLink link={new URL(`https://nos-haiku.vercel.app/entry/${nevent}`)}>
				{$_('poll.vote')}
			</ExternalLink>
		</form>
		{#if endsAt}
			<div>
				{$_('poll.ends_at').replace('%s', new Date(Number(endsAt) * 1000).toLocaleString())}
			</div>
		{/if}
	</section>
</EventMetadata>
