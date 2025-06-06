import type { EventPacket } from 'rx-nostr';
import { map, pipe, type OperatorFunction } from 'rxjs';

export function createTie<P extends EventPacket>(): [
	OperatorFunction<P, P & { seenOn: Set<string>; isNew: boolean }>,
	Map<string, Set<string>>
] {
	const memo = new Map<string, Set<string>>();

	return [
		pipe(
			map((packet) => {
				const seenOn = memo.get(packet.event.id) ?? new Set<string>();
				const isNew = seenOn.size <= 0;

				if (!memo.get(packet.event.id)?.has(packet.from)) {
					seenOn.add(packet.from);
					memo.set(packet.event.id, seenOn);
				}

				return {
					...packet,
					seenOn,
					isNew
				};
			})
		),
		memo
	];
}
