<script lang="ts">
	import { run } from 'svelte/legacy';

	import { nicovideoRegexp } from '$lib/Constants';

	interface Props {
		link: URL;
	}

	let { link }: Props = $props();

	let playerElement: HTMLDivElement | undefined = $state();

	run(() => {
		if (playerElement && playerElement.children.length === 0) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
			const id = link.href.match(nicovideoRegexp)?.groups?.['id']!;
			const scriptElement = document.createElement('script');
			scriptElement.type = 'application/javascript';
			scriptElement.src = `https://embed.nicovideo.jp/watch/${id}/script`;
			playerElement.append(scriptElement);
		}
	});
</script>

<div bind:this={playerElement}></div>
