<script lang="ts">
	import Notification from './Notification.svelte';
	import ReactionEmoji from './ReactionEmoji.svelte';
	import Logout from '../Logout.svelte';
</script>

<h1>Preference</h1>

<div><ReactionEmoji /></div>
<div><Notification /></div>
<div><Logout /></div>

<h1>About nostter</h1>
<div>
	<span>Author:</span>
	<a href="/npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw">@SnowCait</a>
</div>
<div>
	<span>GitHub:</span>
	<a href="https://github.com/SnowCait/nostter" target="_blank" rel="noopener noreferrer">
		SnowCait/nostter
	</a>
</div>

<style>
	div {
		margin: 1em auto;
	}
</style>
