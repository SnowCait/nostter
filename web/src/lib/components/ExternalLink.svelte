<script lang="ts">
	import { page } from '$app/stores';
	import '@tabler/icons-webfont/dist/tabler-icons.min.css';

	export let link: URL;

	$: isInternal = link.origin === $page.url.origin; // Exception
	$: content = link.hostname + link.pathname + link.search + link.hash;

	const threshold = 64;
</script>

<a
	href={link.href}
	target={isInternal ? '_self' : '_blank'}
	rel={isInternal ? '' : 'noopener noreferrer'}
	class:external={!isInternal}
>
	<slot>
		{content.length < threshold ? content : content.substring(0, threshold) + '...'}
	</slot>
</a>

<style>
	a.external::after {
		font-family: 'tabler-icons';
		content: '\ea99';
	}
</style>
