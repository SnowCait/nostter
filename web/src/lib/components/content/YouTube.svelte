<script lang="ts">
	import { ObserverRender } from '@svelteuidev/core';
	import { enablePreview } from '../../../stores/Preference';
	import ExternalLink from '../ExternalLink.svelte';

	export let link: URL;

	let id: string | undefined;

	$: {
		if (link.hostname === 'youtu.be') {
			id = link.pathname.replace('/', '');
		} else {
			const v = link.searchParams.get('v');
			if (v !== null) {
				id = v;
			} else if (link.pathname.includes('shorts')) {
				console.log('[youtube shorts]', link.pathname);
				const match = link.pathname.match(/\/shorts\/(?<id>\w+)/);
				id = match?.groups?.id;
			}
		}
	}
</script>

<ObserverRender let:visible options={{ unobserveOnEnter: true }}>
	{#if id !== undefined && visible && $enablePreview}
		<iframe
			id="ytplayer"
			src="https://www.youtube.com/embed/{id}?origin={location.origin}"
			frameborder="0"
			title=""
		/>
	{:else}
		<ExternalLink {link} />
	{/if}
</ObserverRender>

<style>
	iframe {
		width: 100%;
		aspect-ratio: 640 / 360;
	}
</style>
