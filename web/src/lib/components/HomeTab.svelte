<script lang="ts">
	import { _ } from 'svelte-i18n';

	export let selected: 'home' | 'trend';
</script>

<nav>
	<ul class="card">
		<li class:selected={selected === 'home'}>
			<a href="/home">
				{$_('layout.header.home')}
			</a>
		</li>
		<li class:selected={selected === 'trend'}>
			<a href="/trend">
				{$_('layout.header.global')}
			</a>
		</li>
	</ul>
</nav>

<style>
	ul {
		list-style: none;
		display: flex;
		justify-content: space-around;
		padding: 0;
		background-color: var(--accent-surface-low);
		overflow: hidden;
	}

	li {
		width: 100%;
		height: 100%;
		text-align: center;
		isolation: isolate;
	}

	li > a {
		color: var(--secondary-accent);
	}

	li:hover {
		background-color: var(--accent-surface-high);
	}

	a {
		display: block;
		padding: 0.5rem;
	}

	li.selected {
		background-color: var(--accent);
	}

	li.selected > a {
		color: var(--accent-foreground);
	}

	li + li {
		border-left: var(--default-border);
	}
</style>
