<script lang="ts">
	import { nicovideoRegexp } from '$lib/Constants';

	export let link: URL;

	let playerElement: HTMLDivElement | undefined;

	$: if (playerElement && playerElement.children.length === 0) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		const id = link.href.match(nicovideoRegexp)?.groups?.['id']!;
		const scriptElement = document.createElement('script');
		scriptElement.type = 'application/javascript';
		scriptElement.src = `https://embed.nicovideo.jp/watch/${id}/script`;
		playerElement.append(scriptElement);
	}
</script>

<div bind:this={playerElement}></div>
