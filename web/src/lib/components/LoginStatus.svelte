<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { loginStatus } from '$lib/stores/LoginStatus';
</script>

{#if $loginStatus !== null}
	<div class="login-status login-status-{$loginStatus.level}" role="status" aria-live="polite">
		{$_(`login.status.${$loginStatus.key}`)}
	</div>
{/if}

<style>
	.login-status {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 100;
		padding: 0.5rem 0.75rem;
		border-top: var(--default-border);
		background: var(--surface);
		color: var(--foreground);
		font-size: 0.875rem;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.login-status-success {
		color: var(--green);
	}

	.login-status-error {
		color: var(--red);
	}
</style>
