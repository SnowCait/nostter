<script lang="ts">
	import { preventDefault } from 'svelte/legacy';

	import { _ } from 'svelte-i18n';
	import { now } from 'rx-nostr';
	import { filter } from 'rxjs';
	import type { ChannelContent } from '$lib/Channel';
	import { rxNostr } from '$lib/timelines/MainTimeline';
	import { Signer } from '$lib/Signer';
	import ModalDialog from '../ModalDialog.svelte';

	let open = $state(false);

	let kind = 40;
	let name = $state('');
	let about = $state('');
	let picture = $state('');

	let creatable = $derived(name !== '');

	function createChannel(): void {
		console.log('[channel create]', name, about, picture);

		if (name === '') {
			return;
		}

		const content = {
			name: name.trim()
		} as ChannelContent;
		if (about !== '') {
			content.about = about.trim();
		}
		if (picture !== '' && URL.canParse(picture.trim())) {
			content.picture = picture.trim();
		}

		let first = true;
		Signer.signEvent({
			kind,
			content: JSON.stringify(content),
			tags: [],
			created_at: now()
		}).then((event) => {
			rxNostr
				.send(event)
				.pipe(filter(({ ok }) => ok && first))
				.subscribe(({ eventId }) => {
					console.debug('[channel create done]', eventId);
					first = false;
					open = false;
				});
		});
	}
</script>

<button onclick={() => (open = true)}>{$_('public_chat.create_channel')}</button>

<ModalDialog bind:open>
	<h2>{$_('public_chat.create_channel')}</h2>
	<form onsubmit={preventDefault(createChannel)}>
		<div>
			<label>
				<div>{$_('public_chat.channel.name')}</div>
				<div><input type="text" bind:value={name} required /></div>
			</label>
		</div>
		<div>
			<label>
				<div>{$_('public_chat.channel.about')}</div>
				<div><textarea bind:value={about}></textarea></div>
			</label>
		</div>
		<div>
			<label>
				<div>{$_('public_chat.channel.picture')}</div>
				<div><input type="text" bind:value={picture} placeholder="https://" /></div>
			</label>
		</div>
		<div>
			<input type="submit" value={$_('public_chat.create')} disabled={!creatable} />
		</div>
	</form>
</ModalDialog>

<style>
	form > div {
		margin: 0.5rem auto;
	}

	form > div:last-child {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	textarea {
		width: 100%;
		border: var(--default-border);
	}

	input[type='submit']:disabled {
		background-color: var(--secondary-accent);
	}
</style>
