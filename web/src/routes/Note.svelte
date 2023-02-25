<script lang="ts">
	import type { Event, User } from './types';
	export let event: Event;
	export let user: User | undefined;
</script>

<article>
	<div>
		<img class="picture" src={user?.picture} alt="" />
	</div>
	<div class="note">
		<div class="user">
			<span class="display_name">{user?.display_name}</span>
			<span class="name">@{user?.name}</span>
		</div>
		<div class="content">{event.content}</div>
		<div class="created_at">{new Date(event.created_at * 1000)}</div>
	</div>
</article>

<style>
	article {
		padding: 12px 16px;
		display: flex;
		flex-direction: row;
	}

	.picture {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		margin-right: 12px;
	}

	.note {
		color: rgb(15, 20, 25);
		font-size: 15px;
		font-weight: 400;
	}

	.user {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		font-family: 'Segoe UI', Meiryo, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
	}

	.display_name {
		margin-right: 4px;
		font-weight: 700;
	}

	.name {
		color: rgb(83, 100, 113);
		font-size: 15px;
	}

	.content {
		line-height: 20px;
	}

	.created_at {
		color: gray;
		font-size: 0.5em;
	}
</style>
