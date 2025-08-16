<script lang="ts" context="module">
	export type ToastData = {
		title: string;
		description: string;
	};

	const {
		elements: { content, title, description },
		helpers,
		states: { toasts },
		actions: { portal }
	} = createToaster<ToastData>();

	export const addToast = helpers.addToast;
</script>

<script lang="ts">
	import { createToaster, melt } from '@melt-ui/svelte';
</script>

<div class="toast" use:portal>
	{#each $toasts as { id, data } (id)}
		<div use:melt={$content(id)}>
			<div>
				<div>
					<h3 use:melt={$title(id)}>
						{data.title}
					</h3>
					<div use:melt={$description(id)}>
						{data.description}
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.toast {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 50;
		margin: 1rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.toast > div {
		border-radius: 0.5rem;
		background-color: var(--accent-surface);
		color: var(--accent);
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -2px rgba(0, 0, 0, 0.1);
	}

	.toast > div > div {
		position: relative;
		display: flex;
		width: 24rem;
		max-width: calc(100vw - 2rem);
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
	}

	h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	@media (min-width: 768px) {
		.toast {
			top: auto;
			bottom: 0;
		}
	}
</style>
