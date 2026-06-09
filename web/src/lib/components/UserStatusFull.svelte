<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { chronological } from '$lib/Constants';
	import { findIdentifier } from '$lib/EventHelper';
	import { userStatusesMap } from '$lib/UserStatus';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { IconMusic, IconUser } from '@tabler/icons-svelte-runes';
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

	let isAuthor = $derived(pubkey === $authorPubkey);
	let hasGeneral = $derived(generalEvent !== undefined && generalEvent.content !== '');
	let hasMusic = $derived(musicEvent !== undefined && musicEvent.content !== '');
	let visible = $derived(hasGeneral || hasMusic || isAuthor);

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

{#if visible}
	<h3 class="section-label">{$_('user_status.title')}</h3>
	<section>
		{#if hasGeneral && generalEvent !== undefined}
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
		{#if hasMusic && musicEvent !== undefined}
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
		{#if isAuthor}
			<div>
				<ExternalLink link={new URL('https://nostatus.vercel.app/')}>
					{$_('user_status.edit')}
				</ExternalLink>
			</div>
		{/if}
	</section>
{/if}

<style>
	.section-label {
		margin: 1rem 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 700;
	}

	div {
		color: var(--accent-gray);

		display: flex;
		flex-direction: row;
	}
</style>
