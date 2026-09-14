<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { rxNostr, tie } from '$lib/timelines/MainTimeline';
	import { createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { hexRegexp } from '$lib/Constants';
	import ExternalLink from './ExternalLink.svelte';
	import type * as Nostr from 'nostr-typedef';
	import { findIdentifier } from '$lib/nostr/protocol/event-address';
	import { getEventAddress, parseEventAddress } from '$lib/nostr/protocol/event-address';
	import { nip19 } from 'nostr-tools';
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Subscription } from 'rxjs';
	import {
		legacyProfileBadgesIdentifier,
		legacyProfileBadgesKind,
		profileBadgesKind,
		selectProfileBadgesEvent
	} from '$lib/ProfileBadgesEvent';

	interface Props {
		pubkey: string;
		relays: string[];
	}

	let { pubkey, relays }: Props = $props();

	type AwardId = string;
	type DefinitionAddress = string;

	let profileBadges: { awards: Set<AwardId>; definitions: Set<DefinitionAddress> } | undefined =
		$state();
	let badgeAwards = new SvelteMap<AwardId, DefinitionAddress>();
	let badgeDefinitions = new SvelteMap<DefinitionAddress, Nostr.Event>();

	function addToBadgeAwards(id: AwardId, address: DefinitionAddress): void {
		badgeAwards.set(id, address);
	}

	function updateBadgeDefinitions(address: DefinitionAddress, event: Nostr.Event): void {
		badgeDefinitions.set(address, event);
	}

	$effect(() => {
		const targetPubkey = pubkey;
		const targetRelays = relays;
		const isAuthor = targetPubkey === $authorPubkey;

		untrack(() => {
			profileBadges = undefined;
			badgeAwards.clear();
			badgeDefinitions.clear();
		});

		console.debug('[badges]', targetPubkey, targetRelays);

		const profileBadgesReq = createRxBackwardReq();
		let displayedEvent: Nostr.Event | undefined;
		let awardsSubscription: Subscription | undefined;
		let definitionsSubscription: Subscription | undefined;
		const profileBadgesSubscription = rxNostr
			.use(profileBadgesReq, {
				on: {
					defaultReadRelays: !isAuthor,
					defaultWriteRelays: isAuthor,
					relays: targetRelays
				}
			})
			.pipe(
				tie,
				uniq(),
				latestEach(({ event }) => event.kind)
			)
			.subscribe({
				next: ({ event }) => {
					const selectedEvent = selectProfileBadgesEvent(displayedEvent, event);
					if (selectedEvent === undefined || selectedEvent.id === displayedEvent?.id) {
						return;
					}
					displayedEvent = selectedEvent;

					awardsSubscription?.unsubscribe();
					definitionsSubscription?.unsubscribe();
					badgeAwards.clear();
					badgeDefinitions.clear();

					event = selectedEvent;
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
					awardsSubscription = rxNostr
						.use(awardsReq, {
							on: { defaultReadRelays: true, relays: awardRelays }
						})
						.pipe(tie, uniq())
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
					awardsReq.emit([{ kinds: [8], ids: awardIds, '#p': [event.pubkey] }]);
					awardsReq.over();

					const definitionAddressesGroupedByPubkey = definitionAddresses.reduce(
						(definitions, address) => {
							const parsed = parseEventAddress(address);
							if (!parsed) {
								return definitions;
							}
							const { pubkey, identifier } = parsed;
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
					definitionsSubscription = rxNostr
						.use(definitionsReq, {
							on: { defaultReadRelays: true, relays: definitionRelays }
						})
						.pipe(
							tie,
							uniq(),
							latestEach(({ event }) => getEventAddress(event))
						)
						.subscribe({
							next: ({ event }) => {
								console.debug('[badges definition]', event);
								updateBadgeDefinitions(getEventAddress(event), event);
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
			{ kinds: [profileBadgesKind], authors: [targetPubkey], limit: 1 },
			{
				kinds: [legacyProfileBadgesKind],
				authors: [targetPubkey],
				'#d': [legacyProfileBadgesIdentifier],
				limit: 1
			}
		]);
		profileBadgesReq.over();

		return () => {
			profileBadgesSubscription.unsubscribe();
			awardsSubscription?.unsubscribe();
			definitionsSubscription?.unsubscribe();
		};
	});

	let awardedDefinitions = $derived(
		[...(profileBadges?.awards ?? new Set())]
			.filter((id) => badgeAwards.has(id))
			.map((id) => badgeAwards.get(id)!)
			.filter(
				(address) =>
					profileBadges!.definitions.has(address) && badgeDefinitions.has(address)
			)
			.map((address) => badgeDefinitions.get(address)!)
	);

	let visible = $derived(awardedDefinitions.length > 0 || pubkey === $authorPubkey);
</script>

{#if visible}
	<h3 class="section-label">{$_('badge.title')}</h3>
	<ul class="badges">
		{#each awardedDefinitions as event (event.id)}
			{@const name = event.tags.find(([tagName]) => tagName === 'name')?.at(1)}
			{@const thumb = event.tags.find(([tagName]) => tagName === 'thumb')?.at(1)}
			{@const image = event.tags.find(([tagName]) => tagName === 'image')?.at(1)}
			{@const npub = nip19.npubEncode(event.pubkey)}
			<li>
				<a
					href="https://yakitofu.org/badge/{npub}:{findIdentifier(event.tags) ?? ''}"
					target="_blank"
					rel="noreferrer"
				>
					<img
						src={thumb ? thumb : image}
						alt={name}
						title={name}
						loading="lazy"
						decoding="async"
					/>
				</a>
			</li>
		{:else}
			<li>
				<span>{$_('badge.none')}</span>
				<ExternalLink link={new URL('https://yakitofu.org/')}>
					{$_('badge.create')}
				</ExternalLink>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.section-label {
		margin: 1rem 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 700;
	}

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
