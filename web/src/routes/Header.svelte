<script lang="ts">
	import { IconHome, IconSearch, IconUser, IconCirclePlus } from '@tabler/icons-svelte';
	import { nip19 } from 'nostr-tools';
	import { pubkey } from '../stores/Author';
	import { openNoteDialog } from '../stores/NoteDialog';
	import { rom } from '../stores/Author';

	function toggleNoteDialog() {
		$openNoteDialog = !$openNoteDialog;
	}
</script>

<nav>
	<ul>
		{#if $pubkey}
			<a href="/home">
				<li>
					<IconHome size={30} />
				</li>
			</a>
		{:else}
			<a href="/">
				<li>
					<IconHome size={30} />
				</li>
			</a>
		{/if}
		<a href="/search">
			<li>
				<IconSearch size={30} />
			</li>
		</a>
		{#if $pubkey}
			<a href="/{nip19.npubEncode($pubkey)}">
				<li>
					<IconUser size={30} />
				</li>
			</a>
			{#if !$rom}
				<li>
					<button on:click={toggleNoteDialog}>
						<IconCirclePlus size={30} />
					</button>
				</li>
			{/if}
		{/if}
	</ul>
</nav>

<style>
	ul {
		list-style: none;
		padding: 0;
	}

	li {
		width: 50px;
		height: 50px;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	a:visited {
		color: inherit;
	}

	button {
		background-color: transparent;
		border: none;
		cursor: pointer;
		outline: none;
		padding: 0;
		width: inherit;
		height: inherit;
	}

	@media screen and (max-width: 600px) {
		ul {
			display: flex;
			flex-flow: row;
			justify-content: space-around;
			margin: 0;
		}
	}
</style>
