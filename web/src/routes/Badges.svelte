<script lang="ts">
	import type { Badge } from '$lib/BadgeApi';

	export let badges: Badge[];
</script>

<ul class="badges">
	{#each badges as badge}
		<li>
			<a href="https://badges.page/b/{badge.naddr}" target="_blank" rel="noreferrer">
				<img
					src={badge.thumb ? badge.thumb : badge.image}
					alt={badge.name}
					title={badge.name}
				/>
			</a>
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
