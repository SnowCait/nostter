<script lang="ts" module>
	let fetched = false;
</script>

<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import * as Nostr from 'nostr-typedef';
	import {
		addToPeopleList,
		contains,
		createPeopleList,
		fetchPeopleLists,
		peopleLists,
		processing,
		removeFromPeopleList
	} from '$lib/author/PeopleLists';
	import { getListTitle } from '$lib/List';
	import { aTagContent } from '$lib/EventHelper';
	import { pubkey as authorPubkey } from '$lib/stores/Author';
	import { clearListTimelineIfActive } from '$lib/timelines/ListTimeline';
	import ModalDialog from '../ModalDialog.svelte';

	interface Props {
		pubkey: string;
		open?: boolean;
	}

	let { pubkey, open = $bindable(false) }: Props = $props();

	let lists = $derived([...$peopleLists].map(([, event]) => event));

	const changedLists = new Map<string, boolean>();

	let title = $state('');

	onMount(() => {
		if (fetched) {
			return;
		}
		fetched = true;
		fetchPeopleLists();
	});

	function toggled(e: Event, event: Nostr.Event): void {
		const target = e.target as HTMLInputElement;
		console.debug('[people list toggled]', target.checked);
		const key = aTagContent(event);
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

				clearListTimelineIfActive(event);

				if (add) {
					await addToPeopleList(event, pubkey);
				} else {
					await removeFromPeopleList(event, pubkey);
				}
			})
		);

		changedLists.clear();
		$processing = false;
	}

	async function create(): Promise<void> {
		if (title === '') {
			return;
		} else if ($peopleLists.has(`30000:${authorPubkey}:${title}`)) {
			console.log('[people list create duplicate]', title);
			title = '';
			return;
		}

		console.log('[people list create]', title);
		await createPeopleList(title, pubkey);
		title = '';
	}
</script>

<ModalDialog bind:open on:close={save}>
	<article>
		<h2>{$_('lists.title')}</h2>
		<table>
			<tbody>
				{#each lists as list}
					<tr>
						<td>{getListTitle(list.tags)}</td>
						{#await contains(pubkey, list)}
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
</ModalDialog>

<style>
	tr {
		height: 2rem;
	}
</style>
