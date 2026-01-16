<script lang="ts">
	import Content from '$lib/components/Content.svelte';

	interface Props {
		name: string;
		description: undefined | string;
		icon: undefined | string;
		url: string;
		hostname: string;
	}

	let { name, description, icon, url, hostname }: Props = $props();
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
