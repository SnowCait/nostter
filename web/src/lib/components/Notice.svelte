<script>
	import { page } from '$app/state';
</script>

{#if page.url.hostname === 'nostter.vercel.app'}
	<article>
		<p>Moved to <a href="https://nostter.app/">https://nostter.app/</a></p>
	</article>
{/if}

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
