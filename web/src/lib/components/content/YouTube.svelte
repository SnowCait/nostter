<script lang="ts">
	import { page } from '$app/stores';
	import { enablePreview } from '$lib/stores/Preference';
	import ExternalLink from '../ExternalLink.svelte';

	interface Props {
		link: URL;
	}

	function parseStartTime(value: string | null): number | undefined {
		if (value === null) return undefined;

		if (/^\d+$/u.test(value)) {
			const seconds = Number(value);
			return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
		}

		const match = value.match(
			/^(?:(?<hours>\d+)h)?(?:(?<minutes>\d+)m)?(?:(?<seconds>\d+)s)?$/u
		);
		if (match === null || match[0] === '') return undefined;

		const hours = Number(match.groups?.hours ?? 0);
		const minutes = Number(match.groups?.minutes ?? 0);
		const seconds = Number(match.groups?.seconds ?? 0);
		const totalSeconds = hours * 60 * 60 + minutes * 60 + seconds;

		return Number.isSafeInteger(totalSeconds) && totalSeconds > 0 ? totalSeconds : undefined;
	}

	let { link }: Props = $props();

	let video = $derived.by(() => {
		if (link.hostname === 'youtu.be') {
			return { id: link.pathname.replace('/', ''), short: false };
		}
		if (link.pathname.startsWith('/live/')) {
			return { id: link.pathname.replace('/live/', ''), short: false };
		}
		const v = link.searchParams.get('v');
		if (v !== null) {
			return { id: v, short: false };
		}
		if (link.pathname.includes('shorts')) {
			const match = link.pathname.match(/\/shorts\/(?<id>\w+)/);
			return { id: match?.groups?.id, short: true };
		}
		return { id: undefined, short: false };
	});

	let embedUrl = $derived.by(() => {
		if (video.id === undefined) return undefined;

		const url = new URL(`https://www.youtube.com/embed/${video.id}`);
		url.searchParams.set('origin', $page.url.origin);

		const startTime = parseStartTime(link.searchParams.get('t'));
		if (startTime !== undefined) {
			url.searchParams.set('start', startTime.toString());
		}

		return url.toString();
	});
</script>

{#if video.id !== undefined && $enablePreview}
	<iframe
		class:short={video.short}
		id="ytplayer"
		src={embedUrl}
		title=""
		frameborder="0"
		allow="fullscreen; picture-in-picture; web-share"
		referrerpolicy="strict-origin-when-cross-origin"
	></iframe>
{:else}
	<ExternalLink {link} />
{/if}

<style>
	iframe {
		width: 100%;
		max-width: 100%;
		display: block;
		aspect-ratio: 640 / 360;
	}

	iframe.short {
		height: 28rem;
		width: min(22rem, 100%);
		margin: 0 auto;
	}

	@media (max-width: 600px) {
		iframe.short {
			width: 100%;
			height: auto;
			aspect-ratio: 9 / 16;
		}
	}
</style>
