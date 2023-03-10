<script lang="ts">
	import { IconHome, IconSearch, IconUser } from '@tabler/icons-svelte';
	import { pubkey } from '../stores/Author';
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
</style>
