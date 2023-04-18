<script lang="ts">
	import Notification from './Notification.svelte';
	import ReactionEmoji from './ReactionEmoji.svelte';
	import Logout from '../Logout.svelte';
	import { rom } from '../../stores/Author';
	import { debugMode } from '../../stores/Preference';

	let debugCounter = 0;

	function enableDebugMode() {
		if ($debugMode) {
			return;
		}

		debugCounter++;
		if (debugCounter >= 5) {
			$debugMode = true;
			console.log('[debug mode] enabled');
		}
	}
</script>

<h1>Preference</h1>

{#if !$rom}
	<div><ReactionEmoji /></div>
{/if}
<div><Notification /></div>
<div><Logout /></div>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<h1 on:click={enableDebugMode}>About nostter</h1>
<div>
	<span>GitHub:</span>
	<a href="https://github.com/SnowCait/nostter" target="_blank" rel="noopener noreferrer">
		SnowCait/nostter
	</a>
</div>
<div>
	<span>Author:</span>
	<a href="/npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw">@SnowCait</a>
</div>
<div>
	<span>Illustration:</span>
	<a href="/npub1e09suzmq9mp6nt0ud9ttl03790qjx70wzwlc2pwwghcusvwju54qs0c800">@stok33</a>
</div>
<img
	src="/nostter-chan.jpg"
	alt=""
	title="前から知っていたような雰囲気ですぐ馴染めるタイプの娘。パーカーの中には json が格納されていて聞くと教えてくれるよ。あとかなり物覚えが良いので昔のことも覚えててくれるよ。"
/>

<style>
	div {
		margin: 1em auto;
	}

	img {
		width: 50%;
		border: 1px solid lightgray;
		border-radius: 10px;
	}
</style>
