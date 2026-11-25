<script lang="ts">
	import { untrack } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { _ } from 'svelte-i18n';
	import {
		deletePrivateNickname,
		getPrivateNickname,
		savePrivateNickname
	} from '../application/private-nicknames.svelte';

	interface Props {
		pubkey: string;
		open: boolean;
	}

	let { pubkey, open = $bindable() }: Props = $props();

	let nickname = $derived(getPrivateNickname(pubkey));
	let draft = $state('');
	let saving = $state(false);
	let failed = $state(false);

	$effect(() => {
		if (open) {
			draft = untrack(() => nickname) ?? '';
			failed = false;
		}
	});

	async function update(remove: boolean): Promise<void> {
		saving = true;
		failed = false;
		try {
			if (remove) {
				await deletePrivateNickname(pubkey);
			} else {
				await savePrivateNickname(pubkey, draft);
			}
			open = false;
		} catch {
			failed = true;
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="nickname-overlay" />
		<Dialog.Content
			class="nickname-dialog card"
			escapeKeydownBehavior={saving ? 'ignore' : 'close'}
			interactOutsideBehavior={saving ? 'ignore' : 'close'}
		>
			<Dialog.Title level={2} class="nickname-title">
				{$_(nickname === undefined ? 'nickname.set' : 'nickname.edit')}
			</Dialog.Title>
			<Dialog.Description class="nickname-description">
				{$_('nickname.description')}
			</Dialog.Description>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					if (!saving && draft.trim()) {
						void update(false);
					}
				}}
			>
				<label>
					{$_('nickname.label')}
					<input type="text" bind:value={draft} disabled={saving} />
				</label>
				{#if failed}
					<p role="alert">{$_('nickname.failed')}</p>
				{/if}
				<div class="actions">
					{#if nickname !== undefined}
						<button
							type="button"
							class="delete"
							disabled={saving}
							onclick={() => update(true)}
						>
							{$_('nickname.delete')}
						</button>
					{/if}
					<div class="submit-actions">
						<Dialog.Close type="button" class="rounded-button" disabled={saving}>
							{$_('nickname.cancel')}
						</Dialog.Close>
						<button
							type="submit"
							class="rounded-button primary"
							disabled={saving || !draft.trim()}
						>
							{$_('nickname.save')}
						</button>
					</div>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.nickname-overlay) {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgb(0 0 0 / 45%);
	}

	:global(.nickname-dialog) {
		position: fixed;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: min(24rem, calc(100% - 2rem));
	}

	:global(.nickname-title) {
		margin-block-end: 0.5rem;
		font-size: 1.25rem;
		font-weight: 700;
	}

	:global(.nickname-description) {
		margin-block-end: 1rem;
		color: var(--accent-gray);
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	input {
		min-width: 0;
	}

	[role='alert'] {
		margin-block-start: 0.5rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		margin-block-start: 1.25rem;
	}

	.submit-actions {
		display: flex;
		gap: 0.5rem;
		margin-inline-start: auto;
		white-space: nowrap;
	}

	.delete {
		min-height: 36px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--accent-gray);
		font-weight: inherit;
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.delete:hover {
		color: var(--accent);
		opacity: 1;
	}

	.delete:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
</style>
