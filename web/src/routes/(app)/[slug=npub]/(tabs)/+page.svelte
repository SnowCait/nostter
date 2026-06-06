<script lang="ts">
	import { page } from '$app/state';
	import { nip05 } from 'nostr-tools';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { metadataStore, storeMetadata } from '$lib/cache/Events';
	import { metadataReqEmit, referencesReqEmit } from '$lib/timelines/MainTimeline';
	import { replaceableEvents, replaceableEventsReqEmit } from '$lib/Profile';
	import type { LayoutProps } from './$types';
	import { developerMode } from '$lib/stores/Preference';
	import Notes from './Notes.svelte';
	import PinnedNote from '$lib/components/items/PinnedNote.svelte';
	import ProfileTabs from './ProfileTabs.svelte';

	let { data }: LayoutProps = $props();

	let metadata = $derived($metadataStore.get(data.pubkey));
	let slug = $derived(page.params.slug!);

	afterNavigate(() => {
		console.debug('[npub page]', data.pubkey);

		if (metadata === undefined) {
			if (data.metadataEvent !== undefined) {
				storeMetadata(data.metadataEvent);
			} else {
				metadataReqEmit([data.pubkey]);
			}
		} else {
			referencesReqEmit(metadata.event);
			overwriteSlug();
		}

		if ($developerMode) {
			$replaceableEvents.clear();
			$replaceableEvents = $replaceableEvents;
			replaceableEventsReqEmit(data.pubkey);
		}
	});

	function overwriteSlug() {
		if (metadata?.content === undefined) {
			return;
		}

		const normalizedNip05 = metadata.normalizedNip05;
		if (normalizedNip05 === '' || slug === normalizedNip05) {
			return;
		}

		nip05.queryProfile(normalizedNip05).then((pointer) => {
			if (pointer !== null) {
				replaceState(`/${normalizedNip05}`, {});
				slug = normalizedNip05;
			} else {
				console.warn('[invalid NIP-05]', normalizedNip05);
			}
		});
	}
</script>

<ProfileTabs tab="notes" {slug} />

<PinnedNote pubkey={data.pubkey} {slug} />

{#key data.pubkey}
	<Notes pubkey={data.pubkey} />
{/key}
