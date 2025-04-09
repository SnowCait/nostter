<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Badge } from '$lib/BadgeApi';
	import ExternalLink from './ExternalLink.svelte';

	export let badges: Badge[];
</script>

<ul class="badges">
	{#each badges as badge}
		<li>
			<a href="https://badges.page/a/{badge.naddr}" target="_blank" rel="noreferrer">
				<img
					src={badge.thumb ? badge.thumb : badge.image}
					alt={badge.name}
					title={badge.name}
				/>
			</a>
		</li>
	{:else}
		<li>
			<span>{$_('badge.none')}</span>
			<ExternalLink link={new URL('https://badges.page/')}>
				{$_('badge.create')}
			</ExternalLink>
		</li>
	{/each}
</ul>

<style>
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
