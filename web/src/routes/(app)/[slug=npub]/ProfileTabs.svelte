<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface Props {
		tab: 'notes' | 'media' | 'timeline' | 'reactions' | 'lists' | 'polls';
		slug: string;
	}

	let { tab, slug }: Props = $props();
</script>

<nav class="tabs">
	<a href={`/${slug}`} class:active={tab === 'notes'}>{$_('pages.notes')}</a>
	<a href={`/${slug}/media`} class:active={tab === 'media'}>{$_('pages.media')}</a>
	<a href={`/${slug}/timeline`} class:active={tab === 'timeline'}>{$_('pages.timeline')}</a>
	<a href={`/${slug}/reactions`} class:active={tab === 'reactions'}>{$_('pages.reactions')}</a>
	<a href={`/${slug}/lists`} class:active={tab === 'lists'}>{$_('lists.title')}</a>
	<a href={`/${slug}/polls`} class:active={tab === 'polls'}>{$_('poll.title')}</a>
</nav>

<style>
	.tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: var(--default-border);
		user-select: none;
		overflow-x: auto;
		overflow-y: hidden;
	}

	.tabs a {
		padding: 0.75rem 1rem;
		border-bottom: 3px solid transparent;
		color: var(--foreground);
		text-decoration: none;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.tabs a:hover {
		background-color: var(--hover-background-color);
	}

	.tabs a.active {
		border-color: var(--accent);
		font-weight: bold;
	}
</style>
