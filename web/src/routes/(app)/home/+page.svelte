<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { followees, author } from '$lib/stores/Author';
	import { timeline } from '$lib/timelines/HomeTimeline';
	import { applyTimelieFilter } from '$lib/TimelineFilter';
	import { _ } from 'svelte-i18n';
	import { IconAdjustmentsHorizontal } from '@tabler/icons-svelte';
	import { createCollapsible, melt } from '@melt-ui/svelte';
	import { slide } from 'svelte/transition';
	import TimelineFilter from '../preferences/TimelineFilter.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import { developerMode } from '$lib/stores/Preference';
	import ConnectionStates from '$lib/components/ConnectionStates.svelte';
	import { getDefaultReadRelays } from '$lib/RxNostrHelper';

	const {
		elements: { root, content, trigger },
		states: { open }
	} = createCollapsible();

	onMount(async () => {
		if ($followees.length === 0) {
			await goto('/public');
		}

		applyTimelieFilter();
		timeline.older();
	});
</script>

<header use:melt={$root}>
	<div class="title">
		<h1>{$_('layout.header.home')}</h1>
		<button class="clear" use:melt={$trigger}>
			<IconAdjustmentsHorizontal />
		</button>
	</div>
	{#if $open}
		<div use:melt={$content} transition:slide class="filter">
			<section>
				<h2>{$_('preferences.timeline_filter.title')}</h2>
				<TimelineFilter />
			</section>

			{#if $author !== undefined}
				<section>
					<h2>{$_('about.others')}</h2>
					<ul>
						<li>
							<a href="/latest">{$_('pages.latest')}</a>
						</li>
						<li>
							<a href="/replay/home">{$_('replay.title')}</a>
						</li>
					</ul>
				</section>
			{/if}

			{#if $developerMode}
				<section>
					<h2>{$_('relay.connection.states')}</h2>
					<ConnectionStates relays={getDefaultReadRelays()} />
				</section>
			{/if}
		</div>
	{/if}
</header>

<div class="timeline">
	<Timeline {timeline} />
</div>

<style>
	header div.title {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	header div.title button {
		background: initial;
		color: var(--foreground);
		height: 2rem;
		width: 2rem;
		font-size: 0;
	}

	header div.filter {
		display: flex;
		flex-direction: column;
		margin: 0.5rem 0;
		gap: 0.5rem;
	}

	header div.filter h2 {
		font-size: 1.2rem;
	}

	header div.filter ul {
		margin-left: 2rem;
	}

	button {
		width: 100%;
		height: 2rem;
		background-color: rgb(240, 240, 240);
		color: var(--accent-gray);
	}

	@media screen and (min-width: 601px) {
		.timeline {
			margin-top: 0.75rem;
		}
	}
</style>
