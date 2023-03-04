<script lang="ts">
	import type { Event, User } from './types';
	export let event: Event;
	export let user: User | undefined;
	export let repost: Function;
	export let reaction: Function;
	export let pawPad: boolean;
	const toggleJsonDisplay = (id: string) => {
		console.log(id);
		const classList = document
			.getElementById(id)
			?.getElementsByClassName('develop')
			.item(0)?.classList;
		if (classList === undefined) {
			return;
		}

		if (classList.contains('hidden')) {
			classList.remove('hidden');
		} else {
			classList.add('hidden');
		}
	};
</script>

<article id={event.id}>
	<div>
		<img class="picture" src={user?.picture} alt="" />
	</div>
	<div class="note">
		<div class="user">
			<span class="display_name">{user?.display_name ? user.display_name : user?.name}</span>
			<span class="name">@{user?.name}</span>
		</div>
		<pre class="content">{event.content}</pre>
		<div class="created_at">{new Date(event.created_at * 1000)}</div>
		<div class="action-menu">
			<button on:click={() => repost(event)}>🔁</button>
			<button on:click={() => reaction(event)}>
				{#if pawPad}🐾{:else}💖{/if}
			</button>
			<button on:click={() => toggleJsonDisplay(event.id)}>{'{'} JSON {'}'}</button>
		</div>
		<div class="develop hidden">
			<h5>Event JSON</h5>
			<pre><code class="json">{JSON.stringify(event, null, 2)}</code></pre>
			<h5>User JSON</h5>
			<pre><code class="json">{JSON.stringify(user, null, 2)}</code></pre>
		</div>
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
		margin: 5px 0;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.created_at {
		color: gray;
		font-size: 0.5em;
	}

	.develop pre {
		background-color: #f6f8fa;
		padding: 0.5em;
	}
	.develop .json {
		font-size: 0.8em;
	}

	.action-menu button {
		border: none;
		background-color: inherit;
	}

	.hidden {
		display: none;
	}
</style>
