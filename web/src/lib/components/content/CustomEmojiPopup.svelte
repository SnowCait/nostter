<script lang="ts">
	import { _ } from 'svelte-i18n';
	import CustomEmoji from './CustomEmoji.svelte';
	import { Popover } from 'melt/builders';
	import { rom } from '$lib/stores/Author';
	import { sendReaction } from '$lib/author/Reaction';
	import type { Event } from 'nostr-typedef';
	import { developerMode } from '$lib/stores/Preference';
	import { createRxBackwardReq, uniq } from 'rx-nostr';
	import { referencesReqEmit, rxNostr, tie } from '$lib/timelines/MainTimeline';
	import EventComponent from '../items/EventComponent.svelte';
	import { EventItem } from '$lib/Items';
	import { tap } from 'rxjs';
	import { parseAddress } from '$lib/EventHelper';

	interface Props {
		text?: string;
		url: string;
		address?: string; // kind 30030 address
		event?: Event;
	}

	let { text = '', url, address, event }: Props = $props();

	// Workaround for inconsistent shortcodes
	let shortcode = $derived(text.startsWith(':') ? text : `:${text}:`);

	//#region Emoji set

	let emojisetEvent = $state<Event>();

	$effect(() => {
		if (address === undefined) {
			return;
		}

		const parsed = parseAddress(address);
		if (!parsed) {
			return;
		}
		const [kind, pubkey, identifier] = parsed;
		const req = createRxBackwardReq();
		rxNostr
			.use(req)
			.pipe(
				tie,
				uniq(),
				tap(({ event }) => referencesReqEmit(event))
			)
			.subscribe(({ event }) => {
				emojisetEvent = event;
			});
		req.emit([{ kinds: [kind], authors: [pubkey], '#d': [identifier] }]);
		req.over();
	});

	//#endregion

	//#region UI

	const popover = new Popover({
		closeOnOutsideClick: (element): boolean => {
			if (element instanceof HTMLElement && element.role === 'menu') {
				return false;
			}
			return true;
		}
	});

	async function reaction(): Promise<void> {
		await sendReaction(event!, shortcode, url);
		popover.open = false;
	}

	//#endregion
</script>

<button class="clear" {...popover.trigger}>
	<CustomEmoji {text} {url} />
</button><!-- Workaround to eliminate extra whitespace -->{#if popover.open}
	<div {...popover.content} class="popover">
		<div {...popover.arrow}></div>

		<img src={url} alt={text} title={text} />

		{#if $developerMode}
			<div>{shortcode}</div>
		{/if}

		{#if event && !$rom}
			<button onclick={reaction}>{$_('actions.reaction.same')}</button>
		{/if}

		{#if emojisetEvent}
			<blockquote>
				<EventComponent item={new EventItem(emojisetEvent)} readonly={$rom} />
			</blockquote>
		{/if}
	</div>
{/if}

<style>
	button {
		display: inline;
	}

	.popover {
		color: var(--surface-foreground);
		background-color: var(--surface);
		border: var(--default-border);
		border-radius: var(--radius);
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.popover > * {
		margin: 0 auto;
	}

	img {
		max-height: 3rem;
	}

	blockquote {
		max-width: 600px;
	}
</style>
