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
	<section class="profile">
		<img src={user.picture} alt="" />
		<h1>{user.display_name} @{user.name}</h1>
		<p>{user.about}</p>
	</section>
</main>

<style>
	.profile img {
		width: 128px;
		height: 128px;
		border-radius: 50%;
		margin-right: 12px;
	}
</style>
