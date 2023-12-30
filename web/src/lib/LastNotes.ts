import { batch, createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { bufferTime } from 'rxjs';
import { rxNostr } from './timelines/MainTimeline';
import { maxFilters } from './Constants';
import { lastNotesMap, saveLastNote } from '../stores/LastNotes';
import { get } from 'svelte/store';

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

export function lastNoteReqEmit(pubkeys: string[]) {
	for (const pubkey of pubkeys.filter((p) => !get(lastNotesMap).has(p))) {
		lastNoteReq.emit([
			{
				kinds: [1],
				authors: [pubkey],
				limit: 1
			}
		]);
	}
}
