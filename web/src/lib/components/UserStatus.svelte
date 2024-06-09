<script lang="ts">
	import type { Event } from 'nostr-tools';
	import { chronological } from '$lib/Constants';
	import { findIdentifier } from '$lib/EventHelper';
	import { userStatusesMap } from '$lib/UserStatus';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import IconUser from '@tabler/icons-svelte/dist/svelte/icons/IconUser.svelte';
	import IconMusic from '@tabler/icons-svelte/dist/svelte/icons/IconMusic.svelte';
	import IconLink from '@tabler/icons-svelte/dist/svelte/icons/IconLink.svelte';
	import IconPencil from '@tabler/icons-svelte/dist/svelte/icons/IconPencil.svelte';

	export let pubkey: string;
	export let showLink = false;

	let generalEvent: Event | undefined;
	let musicEvent: Event | undefined;
	let generalLink: URL | undefined;
	let musicLink: URL | undefined;

	$: {
		const statuses = $userStatusesMap.get(pubkey) ?? [];
		statuses.sort(chronological);
		generalEvent = statuses.findLast((event) => findIdentifier(event.tags) === 'general');
		musicEvent = statuses.findLast((event) => findIdentifier(event.tags) === 'music');
	}

	$: {
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
	}
</script>

<section>
	{#if generalEvent !== undefined && generalEvent.content !== ''}
		<div>
			<IconUser size="14" />
			<span>{generalEvent.content}</span>
			{#if showLink}
				{#if generalLink !== undefined}
					<a href={generalLink.href} target="_blank" rel="noopener noreferrer">
						<IconLink size="14" />
					</a>
				{/if}
				{#if pubkey === $authorPubkey}
					<a
						href="https://nostatus.vercel.app/"
						target="_blank"
						rel="noopener noreferrer"
					>
						<IconPencil size="14" />
					</a>
				{/if}
			{/if}
		</div>
	{/if}
	{#if musicEvent !== undefined && musicEvent.content !== ''}
		<div>
			<IconMusic size="14" />
			<span>{musicEvent.content}</span>
			{#if showLink && musicLink !== undefined}
				<a href={musicLink.href} target="_blank" rel="noopener noreferrer">
					<IconLink size="14" />
				</a>
			{/if}
		</div>
	{/if}
</section>

<style>
	section {
		/* Workaround for unnecessary space */
		display: flex;
		flex-direction: column;
	}

	div {
		color: gray;
		font-size: 0.7rem;

		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;

		display: flex;
		flex-direction: row;
	}

	a {
		margin-left: 0.5rem;
	}
</style>
