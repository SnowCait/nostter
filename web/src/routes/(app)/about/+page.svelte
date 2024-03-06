<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { author, rom } from '../../../stores/Author';
	import ZapButton from '$lib/components/ZapButton.svelte';
</script>

<h1>{$_('about.title')}</h1>
<section class="card">
	<div>
		<span>GitHub:</span>
		<a href="https://github.com/SnowCait/nostter" target="_blank" rel="noopener noreferrer">
			SnowCait/nostter
		</a>
	</div>
	<div class="user">
		<span>Author:</span>
		<a href="/npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw">@SnowCait</a>
		<ZapButton pubkey="83d52b4363d2d1bc5a098de7be67c120bfb7c0cee8efefd8eb6e42372af24689" />
	</div>
	<div class="user">
		<span>UI:</span>
		<a href="/npub194qhhn5vzzyrsqaugfms8c7ycqjyvhyguurra450nhlweatfzxkqy8tgkd">@kaiji</a>
		<ZapButton pubkey="2d417bce8c10883803bc427703e3c4c024465c88e7063ed68f9dfeecf56911ac" />
	</div>
	<div class="user">
		<span>Logo:</span>
		<a href="/npub1njty7prjt49kju6c3mjjlxvm0hjymf5s2qlfcyjqg5e0k8kftp3s4dpsn5">@apco</a>
		<ZapButton pubkey="9c964f04725d4b6973588ee52f999b7de44da690503e9c12404532fb1ec95863" />
	</div>
	<div class="user">
		<span>Illustration:</span>
		<a href="/npub1e09suzmq9mp6nt0ud9ttl03790qjx70wzwlc2pwwghcusvwju54qs0c800">@stok33</a>
		<ZapButton pubkey="cbcb0e0b602ec3a9adfc6956bfbe3e2bc12379ee13bf8505ce45f1c831d2e52a" />
	</div>
	<img src="/nostter-chan.jpg" alt="" />
</section>

{#if $author !== undefined && !$rom}
	<h2>{$_('about.others')}</h2>
	<section class="card">
		<div>
			<a href="/latest">{$_('pages.latest')}</a>
		</div>
		<div>
			<a href="/replay/home">{$_('replay.title')}</a>
		</div>
	</section>
{/if}

<style>
	h2 {
		margin-top: 1rem;
	}

	div {
		margin-bottom: 1rem;
	}

	img {
		width: 50%;
		border: 1px solid lightgray;
		border-radius: 10px;
	}

	a {
		text-decoration: underline;
	}

	.user {
		display: flex;
		align-items: center;
	}

	.user * {
		margin-right: 0.2rem;
	}
</style>
