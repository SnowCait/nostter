<script lang="ts">
	import { IconHome, IconSearch, IconUser, IconCirclePlus } from '@tabler/icons-svelte';
	import { pubkey } from '../stores/Author';
	import { openNoteDialog } from '../stores/NoteDialog';

	function toggleNoteDialog() {
		$openNoteDialog = !$openNoteDialog;
	}
</script>

<nav>
	<ol>
		<a href="/home">
			<li>
				<IconHome size={30} />
			</li>
		</a>
		<a href="/search">
			<li>
				<IconSearch size={30} />
			</li>
		</a>
		{#if $pubkey}
			<a href="/p/{$pubkey}">
				<li>
					<IconUser size={30} />
				</li>
			</a>
			<li>
				<button on:click={toggleNoteDialog}>
					<IconCirclePlus size={30} />
				</button>
			</li>
		{/if}
	</ol>
</nav>

<style>
	ol {
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
</style>
