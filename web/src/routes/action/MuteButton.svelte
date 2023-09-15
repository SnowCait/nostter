<script lang="ts">
	import { nip19 } from 'nostr-tools';
	import IconVolumeOff from '@tabler/icons-svelte/dist/svelte/icons/IconVolumeOff.svelte';
	import IconTrash from '@tabler/icons-svelte/dist/svelte/icons/IconTrash.svelte';
	import { pool } from '../../stores/Pool';
	import {
		pubkey as authorPubkey,
		mutePubkeys,
		muteEventIds,
		muteWords,
		writeRelays
	} from '../../stores/Author';
	import { Mute } from '$lib/Mute';

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

	async function mute() {
		console.log('[mute]', logTexts[tagName]);

		if (!confirm(`Mute this ${text ?? texts[tagName]}?`)) {
			console.log('[mute cancelled]');
			return;
		}

		executing = true;

		try {
			await new Mute($authorPubkey, $pool, $writeRelays).mutePrivate(tagName, tagContent);
		} catch (error) {
			alert('Failed to mute.');
		}

		executing = false;
	}

	async function unmute() {
		console.log('[unmute]', logTexts[tagName]);

		if (!confirm(`Unmute this ${text ?? texts[tagName]}?`)) {
			console.log('Unmute is cancelled');
			return;
		}

		executing = true;

		try {
			await new Mute($authorPubkey, $pool, $writeRelays).unmutePrivate(tagName, tagContent);
		} catch (error) {
			alert('Failed to unmute.');
		}

		executing = false;
	}
</script>

{#if (tagName === 'p' ? $mutePubkeys : tagName === 'e' ? $muteEventIds : $muteWords).some((c) => c === tagContent)}
	<div class="muting">
		<span>Muting</span>
		<button on:click={unmute} disabled={executing}><IconTrash /></button>
	</div>
{:else if $authorPubkey !== ''}
	<button on:click={mute} disabled={executing}><IconVolumeOff /></button>
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
