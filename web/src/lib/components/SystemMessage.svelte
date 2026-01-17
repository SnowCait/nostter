<script lang="ts">
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<article class="timeline-item">
	<div>
		<img src="/icon.192.png" alt="" title="" />
	</div>
	<div class="main">
		{@render children?.()}
	</div>
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
		gap: 12px;
	}

	img {
		width: 48px;
		height: 48px;
		border-radius: 50%;
	}

	.main {
		color: var(--foreground);
		font-size: 15px;
		font-weight: 400;
		width: calc(100% - 60px);

		/* Workaround for unnecessary space */
		display: flex;
		flex-direction: column;
	}
</style>
