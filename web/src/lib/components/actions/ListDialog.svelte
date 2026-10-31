<script lang="ts" module>
	let fetched = false;
</script>

<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import type * as Nostr from 'nostr-typedef';
	import {
		addToPeopleList,
		contains,
		createPeopleList,
		fetchPeopleLists,
		peopleLists,
		processing,
		removeFromPeopleList
	} from '$lib/author/PeopleLists';
	import type { PeopleListCapabilities } from '$lib/author/PeopleLists';
	import { getListTitle } from '$lib/List';
	import { getEventAddress } from '$lib/nostr/protocol/event-address';
	import { clearListTimelineIfActive } from '$lib/timelines/ListTimeline';
	import { Dialog } from 'bits-ui';
	import { auth } from '$lib/auth.svelte';

	interface Props {
		pubkey: string;
		getPeopleListCapabilities: () => PeopleListCapabilities;
		open?: boolean;
	}

	let { pubkey, getPeopleListCapabilities, open = $bindable(false) }: Props = $props();

	let lists = $derived([...$peopleLists].map(([, event]) => event));

	const changedLists = new Map<string, boolean>();

	let title = $state('');

	onMount(() => {
		if (fetched) {
			return;
		}
		fetched = true;
		fetchPeopleLists(getPeopleListCapabilities);
	});

	function toggled(e: Event, event: Nostr.Event): void {
		const target = e.target as HTMLInputElement;
		console.debug('[people list toggled]', target.checked);
		const key = getEventAddress(event);
		if (changedLists.has(key)) {
			changedLists.delete(key);
		} else {
			changedLists.set(key, target.checked);
		}
		console.debug('[people list changed]', changedLists);
	}

	async function save(): Promise<void> {
		console.debug('[people list save]', $processing);
		if ($processing) {
			return;
		}

		if (changedLists.size === 0) {
			console.debug('[people list noop]');
			return;
		}

		$processing = true;

		await Promise.allSettled(
			[...changedLists].map(async ([a, add]): Promise<void> => {
				const event = $peopleLists.get(a);
				if (event === undefined) {
					console.error('[people list logic error]', a, $peopleLists);
					return;
				}

				const capabilities = getPeopleListCapabilities();
				clearListTimelineIfActive(event);

				if (add) {
					await addToPeopleList(capabilities.signEvent, event, pubkey);
				} else {
					await removeFromPeopleList(capabilities, event, pubkey);
				}
			})
		);

		changedLists.clear();
		$processing = false;
	}

	async function create(): Promise<void> {
		if (title === '') {
			return;
		}

		const accountPubkey = auth.pubkey;
		if (accountPubkey === undefined) {
			return;
		} else if ($peopleLists.has(`30000:${accountPubkey}:${title}`)) {
			console.log('[people list create duplicate]', title);
			title = '';
			return;
		}

		console.log('[people list create]', title);
		const capabilities = getPeopleListCapabilities();
		await createPeopleList(capabilities.signEvent, title, pubkey);
		title = '';
	}
</script>

<Dialog.Root
	bind:open
	onOpenChangeComplete={(isOpen) => {
		if (!isOpen) {
			void save();
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="people-list-overlay" />
		<Dialog.Content class="card people-list-panel">
			<Dialog.Description class="people-list-a11y"
				>Choose the lists that should contain this person.</Dialog.Description
			>
			<div class="dialog-content">
				<article>
					<Dialog.Title
						>{#snippet child({ props })}<h2 {...props}>
								{$_('lists.title')}
							</h2>{/snippet}</Dialog.Title
					>
					<table>
						<tbody>
							{#each lists as list}
								<tr>
									<td>{getListTitle(list.tags)}</td>
									{#await contains(getPeopleListCapabilities, pubkey, list)}
										<td><input type="checkbox" checked={false} disabled /></td>
									{:then contained}
										<td>
											<input
												type="checkbox"
												checked={contained}
												onchange={(e) => toggled(e, list)}
												disabled={$processing}
											/>
										</td>
									{/await}
								</tr>
							{/each}
							<tr>
								<td><input type="text" bind:value={title} /></td>
								<td><button onclick={create}>{$_('lists.create')}</button></td>
							</tr>
						</tbody>
					</table>
				</article>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.people-list-overlay) {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgb(0 0 0 / 40%);
		cursor: default;
	}
	:global(.people-list-panel) {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: max-content;
		max-width: calc(100vw - 2rem);
		max-height: calc(100dvh - 2rem);
		border-radius: var(--radius);
		cursor: default;
	}
	:global(.people-list-a11y) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.dialog-content {
		margin: 0.5rem;
	}

	tr {
		height: 2rem;
	}
</style>
