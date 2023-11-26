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
	}

	li {
		width: 100%;
		height: 100%;
		padding: 0.5rem;
		text-align: center;
	}

	a {
		display: block;
	}

	li.selected {
		background-color: var(--accent-surface);
	}

	li + li {
		border-left: var(--default-border);
	}
</style>
