<script lang="ts">
	import { appName } from '$lib/Constants';

	function maskNsec(key: string, value: string): string {
		return key === `${appName}:login` && value.startsWith('nsec1') ? 'nsec1***' : value;
	}
</script>

<section class="card">
	<h3>Local storage</h3>
	<code>{JSON.stringify(localStorage, maskNsec, 2)}</code>
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
