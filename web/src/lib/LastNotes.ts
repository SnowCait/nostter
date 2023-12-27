import { batch, createRxBackwardReq, latestEach, uniq } from 'rx-nostr';
import { bufferCount, bufferTime } from 'rxjs';
import { rxNostr } from './timelines/MainTimeline';
import { maxFilters } from './Constants';
import { lastNotesMap, saveLastNotes } from '../stores/LastNotes';
import { get } from 'svelte/store';

const lastNoteReq = createRxBackwardReq();
rxNostr
	.use(lastNoteReq.pipe(bufferCount(maxFilters), batch()))
	.pipe(
		uniq(),
		latestEach(({ event }) => event.pubkey),
		bufferTime(10000)
	)
	.subscribe((packets) => {
		console.log('[rx-nostr last notes]', packets);
		saveLastNotes(packets.map((x) => x.event));
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
