<script lang="ts">
	import type { Metadata } from '$lib/Items';
	import { getCodePoints } from '$lib/String';

	interface Props {
		content: string;
		metadata?: Metadata;
	}
	let { content, metadata }: Props = $props();
</script>

<details>
	<summary>Code Points</summary>
	{#if metadata}
		<h6>display name</h6>
		<p>
			{getCodePoints(metadata.content?.display_name ?? '')
				.map((codePoint) => `0x${codePoint.toString(16)}`)
				.join(' ')}
		</p>
		<h6>@name</h6>
		<p>
			{getCodePoints(metadata.content?.name ?? '')
				.map((codePoint) => `0x${codePoint.toString(16)}`)
				.join(' ')}
		</p>
	{/if}
	<h6>content</h6>
	<p>
		{getCodePoints(content)
			.map((codePoint) => `0x${codePoint.toString(16)}`)
			.join(' ')}
	</p>
</details>

<style>
	details {
		max-width: 500px;
		margin-bottom: 7px;
		border-bottom: 2px solid #d0d0d0;
	}

	details summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: relative;
		padding: 1em 2em;
		color: #333333;
		font-weight: 600;
		cursor: pointer;
	}

	details summary::marker {
		display: none;
	}

	details summary::after {
		transform: translateY(-25%) rotate(45deg);
		width: 7px;
		height: 7px;
		margin-left: 10px;
		border-bottom: 3px solid #333333b3;
		border-right: 3px solid #333333b3;
		content: '';
		transition: transform 0.3s;
	}

	details[open] summary::after {
		transform: rotate(225deg);
	}

	details p {
		margin: 0;
		padding: 0.3em 2em 1.5em;
		color: #333333;
	}
</style>
