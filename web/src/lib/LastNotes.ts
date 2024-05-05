import { get } from 'svelte/store';
import { batch, createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { bufferTime } from 'rxjs';
import { rxNostr } from './timelines/MainTimeline';
import { maxFilters } from './Constants';
import { sleep } from './Helper';
import { lastNotesMap, saveLastNote } from './stores/LastNotes';

const lastNoteReq = createRxBackwardReq();
rxNostr
	.use(lastNoteReq.pipe(bufferTime(1000, null, maxFilters), batch()))
	.pipe(
		uniq(),
		latestEach(({ event }) => event.pubkey)
	)
	.subscribe((packet) => {
		console.log('[rx-nostr last note]', packet);
		saveLastNote(packet.event);
	});

export async function lastNoteReqEmit(pubkeys: string[]): Promise<void> {
	for (const pubkey of pubkeys.filter((p) => !get(lastNotesMap).has(p))) {
		lastNoteReq.emit([
			{
				kinds: [1],
				authors: [pubkey],
				limit: 1
			}
		]);
		await sleep(0); // UI thread
	}
}
