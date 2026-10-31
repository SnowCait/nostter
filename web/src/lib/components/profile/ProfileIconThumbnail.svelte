<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { _ } from 'svelte-i18n';
	import ProfileIcon from './ProfileIcon.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();
</script>

<Dialog.Root>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<button {...props} class="clear" aria-label={$_('profile.picture')}>
				<ProfileIcon {pubkey} />
			</button>
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay class="profile-image-overlay" />
		<Dialog.Content class="profile-image-panel">
			<Dialog.Title class="profile-image-a11y">{$_('profile.picture')}</Dialog.Title>
			<Dialog.Description class="profile-image-a11y"
				>View the full-size profile picture.</Dialog.Description
			>
			<ProfileIcon {pubkey} width="auto" height="auto" />
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.profile-image-overlay) {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgb(0 0 0 / 90%);
		cursor: default;
	}
	:global(.profile-image-panel) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: max-content;
		max-width: calc(100vw - 2rem);
		max-height: calc(100dvh - 2rem);
		border: none;
		background: transparent;
		outline: none;
		cursor: default;
	}
	:global(.profile-image-a11y) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	button {
		width: 100%;
		height: 100%;
	}

	:global(.profile-image-panel img) {
		max-width: 60vw;
		max-height: 60vh;
		border-radius: 0;
		object-fit: contain;
	}
</style>
