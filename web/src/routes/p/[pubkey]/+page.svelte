<script lang="ts">
	import { error } from '@sveltejs/kit';
	import { page } from '$app/stores';
	import { userEvents } from '../../../stores/UserEvents';

	const pubkey = $page.params.pubkey;

	const user = $userEvents.get(pubkey)?.user;
	if (user === undefined) {
		throw error(404);
	}

	console.log(user);
</script>

<svelte:head>
	<title>{user.display_name} (@{user.name}) - nostter</title>
</svelte:head>

<main>
	<section>
		<div class="banner">
			<img src={user.banner} alt="" />
		</div>
		<div class="profile">
			<img src={user.picture} alt="" />
			<h1>{user.display_name ?? user.name ?? ''}</h1>
			{#if user.name}
				<h2>@{user.name}</h2>
			{/if}
			{#if user.about}
				<pre>{user.about}</pre>
			{/if}
		</div>
	</section>
</main>

<style>
	.banner img {
		object-fit: cover;
		width: 100%;
		height: 200px;
	}

	.profile img {
		width: 128px;
		height: 128px;
		border-radius: 50%;
		margin-right: 12px;
	}

	.profile h1 {
		margin: 0;
	}

	.profile h2 {
		margin: 0;
		color: gray;
		font-size: 1em;
	}

	.profile pre {
		line-height: 1.5em;
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
