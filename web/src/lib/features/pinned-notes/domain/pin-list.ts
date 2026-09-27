import { unique } from '$lib/array';

export type PinOperation = { type: 'pin' | 'unpin'; eventId: string };

export function applyPinOperations(tags: string[][], operations: PinOperation[]): string[][] {
	return operations.reduce((current, operation) => {
		if (operation.type === 'pin') {
			return current.some(([name, id]) => name === 'e' && id === operation.eventId)
				? current
				: [...current, ['e', operation.eventId]];
		}
		return current.filter(([name, id]) => name !== 'e' || id !== operation.eventId);
	}, tags);
}

export function pinnedEventIds(tags: string[][]): string[] {
	return unique(tags.filter(([name, id]) => name === 'e' && id).map(([, id]) => id));
}
