<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import IconVolumeOff from '@tabler/icons-svelte/icons/volume-off';
	import IconTrash from '@tabler/icons-svelte/icons/trash';
	import {
		pubkey as authorPubkey,
		mutePubkeys,
		muteEventIds,
		muteWords
	} from '$lib/stores/Author';
	import { mute, unmute } from '$lib/author/Mute';

	export let tagName: 'p' | 'e' | 'word';
	export let tagContent: string;
	export let text: string | undefined = undefined;

	let executing = false;

	const texts = {
		p: 'user',
		e: 'thread',
		word: 'word'
	};

	const logTexts = {
		p: nip19.npubEncode(tagContent),
		e: nip19.neventEncode({ id: tagContent }),
		word: tagContent
	};

	async function onMute(): Promise<void> {
		console.log('[mute]', logTexts[tagName]);

		if (!confirm(`Mute this ${text ?? texts[tagName]}?`)) {
			console.log('[mute cancelled]');
			return;
		}

		executing = true;

		try {
			await mute(tagName, tagContent);
		} catch (error) {
			alert('Failed to mute.');
		}

		executing = false;
	}

	async function onUnmute(): Promise<void> {
		console.log('[unmute]', logTexts[tagName]);

		if (!confirm(`Unmute this ${text ?? texts[tagName]}?`)) {
			console.log('Unmute is cancelled');
			return;
		}

		executing = true;

		try {
			await unmute(tagName, tagContent);
		} catch (error) {
			alert('Failed to unmute.');
		}

		executing = false;
	}
</script>

{#if (tagName === 'p' ? $mutePubkeys : tagName === 'e' ? $muteEventIds : $muteWords).some((c) => c === tagContent)}
	<div class="muting">
		<span>Muting</span>
		<button on:click={onUnmute} disabled={executing}><IconTrash /></button>
	</div>
{:else if $authorPubkey !== ''}
	<button on:click={onMute} disabled={executing}><IconVolumeOff /></button>
{/if}

<style>
	.muting {
		display: flex;
		flex-direction: row;
	}

	button {
		border: none;
		background-color: inherit;
		cursor: pointer;
		outline: none;
		padding: 0;
		color: gray;
		height: 20px;

		margin-left: 0.2em;
	}
</style>
