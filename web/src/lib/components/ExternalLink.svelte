<script lang="ts">
	import '@tabler/icons-webfont/dist/tabler-icons.min.css';

	export let link: URL;

	$: content = link.hostname + link.pathname + link.search + link.hash;

	const threshold = 64;
</script>

<a href={link.href} target="_blank" rel="noopener noreferrer">
	<slot>
		{content.length < threshold ? content : content.substring(0, threshold) + '...'}
	</slot>
</a>

<style>
	a::after {
		font-family: 'tabler-icons';
		content: '\ea99';
	}
</style>
