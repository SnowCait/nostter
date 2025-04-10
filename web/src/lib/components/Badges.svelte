<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { createRxBackwardReq, latest, latestEach, uniq } from 'rx-nostr';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { hexRegexp } from '$lib/Constants';
	import { browser } from '$app/environment';
	import ExternalLink from './ExternalLink.svelte';
	import type { Event } from 'nostr-typedef';
	import { aTagContent, findIdentifier } from '$lib/EventHelper';
	import { nip19 } from 'nostr-tools';

	export let pubkey: string;
	export let relays: string[];

	type AwardId = string;
	type DefinitionAddress = string;

	let profileBadges: { awards: Set<AwardId>; definitions: Set<DefinitionAddress> } | undefined;
	let badgeAwards = new Map<AwardId, DefinitionAddress>();
	let badgeDefinitions = new Map<DefinitionAddress, Event>();

	$: awardedDefinitions = [...(profileBadges?.awards ?? new Set())]
		.filter((id) => badgeAwards.has(id))
		.map((id) => badgeAwards.get(id)!)
		.filter(
			(address) => profileBadges!.definitions.has(address) && badgeDefinitions.has(address)
		)
		.map((address) => badgeDefinitions.get(address)!);

	$: if (browser) {
		console.debug('[badges]', pubkey, relays);

		const profileBadgesReq = createRxBackwardReq();
		const isAuthor = pubkey === $authorPubkey;
		rxNostr
			.use(profileBadgesReq, {
				on: { defaultReadRelays: !isAuthor, defaultWriteRelays: isAuthor, relays }
			})
			.pipe(uniq(), latest())
			.subscribe({
				next: ({ event }) => {
					console.debug('[badges profile]', event);

					const awardTags = event.tags.filter(
						([tagName, id]) => tagName === 'e' && hexRegexp.test(id)
					);
					const awardIds = awardTags.map(([, id]) => id);

					const definitionTags = event.tags.filter(
						([tagName, address]) => tagName === 'a' && address.startsWith('30009:')
					);
					const definitionAddresses = definitionTags.map(([, address]) => address);

					profileBadges = {
						awards: new Set(awardIds),
						definitions: new Set(definitionAddresses)
					};

					const awardRelays = awardTags
						.map(([, , relay]) => relay)
						.filter((relay) => relay !== undefined && URL.canParse(relay));

					const awardsReq = createRxBackwardReq();
					rxNostr
						.use(awardsReq, {
							on: { defaultReadRelays: true, relays: awardRelays }
						})
						.pipe(uniq())
						.subscribe({
							next: ({ event }) => {
								console.debug('[badges award]', event);
								const address = event.tags
									.find(
										([tagName, address]) =>
											tagName === 'a' && address.startsWith('30009:')
									)
									?.at(1);
								if (address) {
									addToBadgeAwards(event.id, address);
								}
							}
						});
					awardsReq.emit([{ kinds: [8], ids: awardIds }]);
					awardsReq.over();

					const definitionAddressesGroupedByPubkey = definitionAddresses.reduce(
						(definitions, address) => {
							const [, pubkey, identifier] = address.split(':');
							if (!definitions.has(pubkey)) {
								definitions.set(pubkey, new Set());
							}
							definitions.get(pubkey)!.add(identifier);
							return definitions;
						},
						new Map<string, Set<string>>()
					);
					const definitionRelays = definitionTags
						.map(([, , relay]) => relay)
						.filter((relay) => relay !== undefined && URL.canParse(relay));

					const definitionsReq = createRxBackwardReq();
					rxNostr
						.use(definitionsReq, {
							on: { defaultReadRelays: true, relays: definitionRelays }
						})
						.pipe(
							uniq(),
							latestEach(({ event }) => aTagContent(event))
						)
						.subscribe({
							next: ({ event }) => {
								console.debug('[badges definition]', event);
								updateBadgeDefinitions(aTagContent(event), event);
							}
						});
					for (const [
						pubkey,
						identifiers
					] of definitionAddressesGroupedByPubkey.entries()) {
						definitionsReq.emit([
							{
								kinds: [30009],
								authors: [pubkey],
								'#d': [...identifiers]
							}
						]);
					}
					definitionsReq.over();
				}
			});
		profileBadgesReq.emit([
			{ kinds: [30008], authors: [pubkey], '#d': ['profile_badges'], limit: 1 }
		]);
		profileBadgesReq.over();
	}

	function addToBadgeAwards(id: AwardId, address: DefinitionAddress): void {
		badgeAwards = badgeAwards.set(id, address);
	}

	function updateBadgeDefinitions(address: DefinitionAddress, event: Event): void {
		badgeDefinitions = badgeDefinitions.set(address, event);
	}
</script>

<ul class="badges">
	{#each awardedDefinitions as event (event.id)}
		{@const name = event.tags.find(([tagName]) => tagName === 'name')?.at(1)}
		{@const thumb = event.tags.find(([tagName]) => tagName === 'thumb')?.at(1)}
		{@const image = event.tags.find(([tagName]) => tagName === 'image')?.at(1)}
		{@const naddr = nip19.naddrEncode({
			kind: event.kind,
			pubkey: event.pubkey,
			identifier: findIdentifier(event.tags) ?? ''
		})}
		<li>
			<a href="https://badges.page/a/{naddr}" target="_blank" rel="noreferrer">
				<img src={thumb ? thumb : image} alt={name} title={name} />
			</a>
		</li>
	{:else}
		<li>
			<span>{$_('badge.none')}</span>
			<ExternalLink link={new URL('https://badges.page/')}>
				{$_('badge.create')}
			</ExternalLink>
		</li>
	{/each}
</ul>

<style>
	.badges {
		list-style: none;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
	}

	.badges img {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		object-fit: cover;
	}
</style>
