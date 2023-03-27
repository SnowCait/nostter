<script lang="ts">
	import Notification from './Notification.svelte';
	import ReactionEmoji from './ReactionEmoji.svelte';
	import Logout from '../Logout.svelte';
</script>

<h1>Preference</h1>

<div><ReactionEmoji /></div>
<div><Notification /></div>
<div><Logout /></div>

<style>
	div {
		margin: 1em auto;
	}
</style>
