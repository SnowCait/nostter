<script lang="ts">
	import { page } from '$app/state';
	import { metadataStore } from '$lib/cache/Events';
	import type { LayoutProps } from './$types';
	import Profile from './Profile.svelte';

	let { data, children }: LayoutProps = $props();

	let slug = $derived(page.params.slug!);
	let metadata = $derived($metadataStore.get(data.pubkey));
</script>

<section class="card">
	<Profile {slug} pubkey={data.pubkey} {metadata} relays={data.relays} />
</section>

{@render children()}
