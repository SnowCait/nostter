<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { nip05 } from 'nostr-tools';
	import { Popover } from 'bits-ui';
	import {
		diagnoseNostrAddress,
		getNostrAddressQuery,
		type NostrAddressDiagnosis
	} from './nostr-address-diagnostics';
	import type { Metadata } from '$lib/Items';
	import IconRosetteDiscountCheck from '@tabler/icons-svelte-runes/icons/rosette-discount-check';
	import IconAlertTriangle from '@tabler/icons-svelte-runes/icons/alert-triangle';

	interface Props {
		metadata: Metadata;
		diagnostics?: boolean;
	}

	let { metadata, diagnostics = false }: Props = $props();

	let normalizedNip05 = $derived(metadata.normalizedNip05);
	let open = $state(false);
	let query = $derived(getNostrAddressQuery(normalizedNip05));
	let diagnosis = $state<NostrAddressDiagnosis>();

	$effect(() => {
		const target = metadata;
		const request = query;
		const profilePubkey = metadata.event.pubkey;
		diagnosis = undefined;
		if (!diagnostics) {
			open = false;
			return;
		}
		if (!open || !request) {
			return;
		}

		const controller = new AbortController();
		diagnoseNostrAddress(request, profilePubkey, controller.signal).then((result) => {
			if (!controller.signal.aborted && metadata === target) {
				diagnosis = result;
			}
		});
		return () => controller.abort();
	});
</script>

{#if normalizedNip05}
	<div class="nip05">
		{#if diagnostics}
			<Popover.Root bind:open>
				<Popover.Trigger>
					{#snippet child({ props })}
						<button class="clear address" {...props}>{normalizedNip05}</button>
					{/snippet}
				</Popover.Trigger>

				<Popover.Portal>
					<Popover.Content
						sideOffset={8}
						collisionPadding={8}
						trapFocus={false}
						style="z-index: 30"
						role="dialog"
						aria-label={$_('profile.nip05.title')}
					>
						{#snippet child({ props, wrapperProps })}
							<div {...wrapperProps}>
								<div {...props} class="diagnostics">
									<dl>
										<dt>{$_('profile.nip05.title')}</dt>
										<dd>{metadata.content?.nip05}</dd>
										<dt>{$_('profile.nip05.diagnostics.queryUrl')}</dt>
										<dd>
											{#if query}
												<a
													href={query.url}
													target="_blank"
													rel="noopener noreferrer">{query.url}</a
												>
											{:else}
												{$_('profile.nip05.diagnostics.invalidAddress')}
											{/if}
										</dd>
										<dt>{$_('profile.nip05.diagnostics.result')}</dt>
										<dd aria-live="polite" role="status">
											{#if !query}
												{$_('profile.nip05.diagnostics.invalidAddress')}
											{:else if !diagnosis}
												{$_('profile.nip05.diagnostics.loading')}
											{:else if diagnosis.status === 'httpError'}
												{$_('profile.nip05.diagnostics.httpError', {
													values: { status: diagnosis.code }
												})}
											{:else}
												{$_(
													`profile.nip05.diagnostics.${diagnosis.status}`
												)}
											{/if}
										</dd>
									</dl>
								</div>
							</div>
						{/snippet}
					</Popover.Content>
				</Popover.Portal>
			</Popover.Root>
		{:else}
			<span class="address">{normalizedNip05}</span>
		{/if}
		{#await nip05.queryProfile(normalizedNip05) then pointer}
			{#if pointer === null}
				<span class="status">
					<IconAlertTriangle color="orange" />
					<span class="label">{$_('profile.nip05.unknown')}</span>
				</span>
			{:else if pointer.pubkey === metadata.event.pubkey}
				<span class="status">
					<IconRosetteDiscountCheck color="skyblue" />
				</span>
			{:else}
				<span class="status">
					<IconAlertTriangle color="red" />
					<span class="label">{$_('profile.nip05.impersonation')}</span>
				</span>
			{/if}
		{/await}
	</div>
{/if}

<style>
	.nip05 {
		margin: 0.35rem 0;
		display: inline-flex;
		align-items: flex-start;
		gap: 0.2rem;
		max-width: 100%;
	}

	.address {
		color: inherit;
		font: inherit;
		min-width: 0;
		overflow-wrap: anywhere;
		text-align: start;
	}

	.address:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	.status {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 0.2rem;
		white-space: nowrap;
	}

	.diagnostics {
		width: min(28rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: auto;
		overflow-wrap: anywhere;
		padding: 1rem;
		border: var(--default-border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		background-color: var(--surface);
		color: var(--surface-foreground);
		font-size: 0.9375rem;
		line-height: 1.4;
	}

	dl {
		margin: 0;
	}

	dt {
		font-weight: bold;
	}

	dt:not(:first-child) {
		margin-top: 1rem;
	}

	dd {
		margin: 0.25rem 0 0;
	}
</style>
