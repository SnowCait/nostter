import { rxNostr } from './timelines/MainTimeline';

export const pollKind = 1068;
export const voteKind = 1018;

export function vote(id: string, optionIds: string[], relays: string[]): void {
	console.debug('[poll vote]', id, optionIds, relays);
	rxNostr.send(
		{
			kind: voteKind,
			content: '',
			tags: [['e', id], ...optionIds.map((id) => ['response', id])]
		},
		{ on: { defaultWriteRelays: true, relays } }
	);
}
