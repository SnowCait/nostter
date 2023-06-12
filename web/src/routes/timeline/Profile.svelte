<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import type { Event } from '../types';
	import Follow from '../Follow.svelte';
	import { rom } from '../../stores/Author';
	import { lastNotesMap } from '../../stores/LastNotes';
	import Content from '../content/Content.svelte';

	export let event: Event;

	$: user = event.user;
	$: createdAt = $lastNotesMap.get(event.pubkey)?.created_at;
</script>

<article class="timeline-item">
	<div>
		<a href="/{nip19.npubEncode(event.pubkey)}">
			<img class="picture" src={user.picture} alt="" />
		</a>
	</div>
	<div class="text">
		<div class="row">
			<div class="display_name">{user.display_name ?? user.name}</div>
			<div class="name">@{user.name ?? user.display_name}</div>
			{#if !$rom}
				<div class="follow">
					<Follow pubkey={event.pubkey} />
				</div>
			{/if}
		</div>
		{#if user.about !== undefined}
			<Content content={user.about} tags={event.tags} />
		{/if}
		{#if !$rom}
			<div>Last note: {createdAt ? new Date(createdAt * 1000).toLocaleString() : '-'}</div>
		{/if}
	</div>
</article>

<style>
	article {
		display: flex;
		flex-direction: row;
	}

	img {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;

		margin-right: 12px;
	}

	.text {
		width: 100%;
	}

	.row {
		display: flex;
		flex-direction: row;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: rgb(83, 100, 113);
		font-size: 15px;
	}

	.follow {
		margin-left: auto;
	}
</style>
