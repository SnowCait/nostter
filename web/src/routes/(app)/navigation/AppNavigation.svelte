<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { lastReadAt, notifiedEventItems } from '$lib/author/Notifications';
	import { isVisibleNotification } from '$lib/preferences/NotificationVisibility.svelte';
	import { MouseButton } from '$lib/platform/browser/mouse-button';
	import { requestTimelineScrollToTop } from '$lib/timelines/ScrollToTop';
	import DesktopNavigation from './DesktopNavigation.svelte';
	import { getCurrentAppNavigation } from './app-navigation';
	import MobileNavigation from './MobileNavigation.svelte';

	interface Props {
		pubkey: string | undefined;
		homeLink: string;
	}

	let { pubkey, homeLink }: Props = $props();

	function requestTimelineScrollToTopForCurrentLink(event: MouseEvent, link: string): boolean {
		if (
			event.button !== MouseButton.Left ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			page.url.pathname !== link
		) {
			return false;
		}

		event.preventDefault();
		requestTimelineScrollToTop(link);
		return true;
	}

	function onClickHomeLink(event: MouseEvent): void {
		requestTimelineScrollToTopForCurrentLink(event, homeLink);
	}

	function onClickPublicLink(event: MouseEvent): void {
		requestTimelineScrollToTopForCurrentLink(event, '/public');
	}

	async function onClickPublicMenuItem(event: MouseEvent): Promise<void> {
		if (requestTimelineScrollToTopForCurrentLink(event, '/public')) {
			return;
		}

		await goto('/public');
	}

	let nprofile = $derived(nip19.nprofileEncode({ pubkey }));
	let notificationsBadge = $derived(
		$notifiedEventItems.filter(
			(item) =>
				item.event.created_at > $lastReadAt && isVisibleNotification(item.event.pubkey)
		).length > 0
	);
	let currentNavigation = $derived(
		getCurrentAppNavigation(page.route.id, page.data.pubkey, pubkey)
	);
</script>

<nav>
	<DesktopNavigation
		{pubkey}
		{homeLink}
		{nprofile}
		{notificationsBadge}
		{currentNavigation}
		{onClickHomeLink}
		{onClickPublicLink}
	/>
	<MobileNavigation
		{pubkey}
		{homeLink}
		{nprofile}
		{notificationsBadge}
		{currentNavigation}
		{onClickHomeLink}
		{onClickPublicLink}
		{onClickPublicMenuItem}
	/>
</nav>

<style>
	nav {
		margin-top: 1rem;
		margin-bottom: 1.5rem;
	}

	@media screen and (max-width: 600px) {
		nav {
			margin: 0;
			width: 100%;
		}
	}
</style>
