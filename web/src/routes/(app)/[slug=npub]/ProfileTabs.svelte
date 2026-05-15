<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface Props {
		tab: 'notes' | 'media' | 'timeline' | 'reactions' | 'lists' | 'polls';
		slug: string;
	}

	let { tab, slug }: Props = $props();
</script>

<nav class="tabs">
	<a href={`/${slug}`} class:active={tab === 'notes'}>{$_('Notes')}</a>
	<a href={`/${slug}/media`} class:active={tab === 'media'}>{$_('Media')}</a>
	<a href={`/${slug}/timeline`} class:active={tab === 'timeline'}>{$_('Timeline')}</a>
	<a href={`/${slug}/reactions`} class:active={tab === 'reactions'}>{$_('Reactions')}</a>
	<a href={`/${slug}/lists`} class:active={tab === 'lists'}>{$_('Lists')}</a>
	<a href={`/${slug}/polls`} class:active={tab === 'polls'}>{$_('Polls')}</a>
</nav>

<style>
	.tabs {
		justify-content: space-between;
		border-bottom: var(--default-border);
		user-select: none;
	}

	.tabs a {
		padding: 0.5rem 0;
		border-bottom: 2px solid transparent;
		color: var(--text);
		text-decoration: none;
	}

	.tabs a.active {
		border-color: var(--accent);
		font-weight: bold;
	}
</style>
