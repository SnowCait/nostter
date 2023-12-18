<section class="card">
	<h3>Local storage</h3>
	<code>{JSON.stringify(localStorage, null, 2)}</code>
</section>

<section class="card">
	<h3>Session storage</h3>
	<code>{JSON.stringify(sessionStorage, null, 2)}</code>
</section>

<style>
	section + section {
		margin-top: 1rem;
	}

	h3 {
		margin: 0.5rem auto;
	}
</style>
