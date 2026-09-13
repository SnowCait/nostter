<script lang="ts">
	import { nicovideoRegexp } from '$lib/Constants';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();

	let playerElement: HTMLDivElement | undefined = $state();

	$effect(() => {
		const element = playerElement;
		if (element === undefined) {
			return;
		}

		const match = link.href.match(nicovideoRegexp);
		const id = match?.groups?.['id'];
		if (id === undefined) {
			return;
		}

		const scriptElement = document.createElement('script');
		scriptElement.type = 'application/javascript';
		scriptElement.src = `https://embed.nicovideo.jp/watch/${id}/script`;
		element.append(scriptElement);

		return () => {
			element.replaceChildren();
		};
	});
</script>

<div class="player" bind:this={playerElement}></div>

<style>
	.player {
		width: 100%;
		max-width: 100%;
		overflow: hidden;
	}

	.player :global(iframe) {
		display: block;
		max-width: 100%;
	}
</style>
