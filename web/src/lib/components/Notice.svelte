<script>
	import { page } from '$app/stores';
</script>

<article>
	{#if $page.url.hostname === 'nostter.vercel.app'}
		<p>Moved to <a href="https://nostter.app/">https://nostter.app/</a></p>
	{/if}
</article>

<style>
	p {
		padding: 1rem;
		text-align: center;
		background-color: coral;
	}

	a {
		font-weight: bold;
		color: antiquewhite;
	}

	@media screen and (max-width: 600px) {
		article {
			margin-top: 3.125rem;
		}
	}
</style>
