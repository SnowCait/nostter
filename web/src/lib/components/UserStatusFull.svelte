<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { chronological } from '$lib/Constants';
	import { findIdentifier } from '$lib/EventHelper';
	import { userStatusesMap } from '$lib/UserStatus';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { IconMusic, IconUser } from '@tabler/icons-svelte';
	import EmojifiedContent from './EmojifiedContent.svelte';
	import ExternalLink from './ExternalLink.svelte';
	import { _ } from 'svelte-i18n';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	let generalEvent = $state<Event>();
	let musicEvent = $state<Event>();
	let generalLink = $state<URL>();
	let musicLink = $state<URL>();

	$effect(() => {
		const statuses = $userStatusesMap.get(pubkey) ?? [];
		statuses.sort(chronological);
		generalEvent = statuses.findLast((event) => findIdentifier(event.tags) === 'general');
		musicEvent = statuses.findLast((event) => findIdentifier(event.tags) === 'music');
	});

	$effect(() => {
		const generalLinkTag = generalEvent?.tags.find(
			([tagName, url]) => tagName === 'r' && url !== undefined
		);
		const musicLinkTag = musicEvent?.tags.find(
			([tagName, url]) => tagName === 'r' && url !== undefined
		);
		try {
			if (generalLinkTag !== undefined) {
				generalLink = new URL(generalLinkTag[1]);
			}
			if (musicLinkTag !== undefined) {
				musicLink = new URL(musicLinkTag[1]);
			}
		} catch (error) {
			console.error('[user status link error]', error, generalLinkTag, musicLinkTag);
		}
	});
</script>

{#snippet content(event: Event)}
	<span class="content">
		<EmojifiedContent content={event.content} tags={event.tags} />
	</span>
{/snippet}

<section>
	{#if generalEvent !== undefined && generalEvent.content !== ''}
		<div class="general">
			<span><IconUser size="14" /></span>
			{#if generalLink !== undefined}
				<ExternalLink link={generalLink}>
					{@render content(generalEvent)}
				</ExternalLink>
			{:else}
				{@render content(generalEvent)}
			{/if}
		</div>
	{/if}
	{#if musicEvent !== undefined && musicEvent.content !== ''}
		<div class="music">
			<span><IconMusic size="14" /></span>
			{#if musicLink !== undefined}
				<ExternalLink link={musicLink}>
					{@render content(musicEvent)}
				</ExternalLink>
			{:else}
				{@render content(musicEvent)}
			{/if}
		</div>
	{/if}
	{#if pubkey === $authorPubkey}
		<div>
			<ExternalLink link={new URL('https://nostatus.vercel.app/')}>
				{$_('user_status.edit')}
			</ExternalLink>
		</div>
	{/if}
</section>

<style>
	div {
		color: var(--accent-gray);

		display: flex;
		flex-direction: row;
	}
</style>
