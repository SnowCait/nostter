<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { auth } from '$lib/auth.svelte';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { userStatuses } from '../application/user-statuses.svelte';
	import UserStatusStacked from './UserStatusStacked.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	const editorUrl = new URL('https://nostatus.vercel.app/');

	let isAuthor = $derived(pubkey === auth.pubkey);
	let statuses = $derived(userStatuses.get(pubkey));
	let visible = $derived(
		statuses.general !== undefined || statuses.music !== undefined || isAuthor
	);

	$effect(() => userStatuses.observe(pubkey));
</script>

{#if visible}
	<h3 class="section-label">{$_('user_status.title')}</h3>
	<section>
		<UserStatusStacked {pubkey} />
		{#if isAuthor}
			<div class="edit">
				<ExternalLink link={editorUrl}>
					{$_('user_status.edit')}
				</ExternalLink>
			</div>
		{/if}
	</section>
{/if}

<style>
	.section-label {
		margin: 1rem 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 700;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.edit {
		color: var(--accent-gray);
	}
</style>
