<script lang="ts">
	import Content from '$lib/components/Content.svelte';

	export let name: string;
	export let description: undefined | string;
	export let icon: undefined | string;
	export let url: string;
	export let hostname: string;
</script>

<article class="timeline-item">
	<div>
		<a href="/{hostname}">
			<img src={icon || url + '/favicon.ico'} alt={name} style="width: 48px; height: 48px;" />
		</a>
	</div>
	<div class="text">
		<div class="row">
			<div class="display_name">
				{name || hostname}
			</div>
		</div>
		<div class="name">@{hostname}</div>
		{#if description !== undefined}
			<Content content={description || ''} tags={[]} />
		{/if}
	</div>
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
		gap: 12px;
	}

	.text {
		width: 100%;
	}

	.row {
		display: flex;
		flex-direction: row;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: var(--accent-gray);
		font-size: 15px;
	}

	.display_name,
	.name {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
</style>
