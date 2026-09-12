import { isValidEventId } from './event-id';

export function getReactionTargetEventId(tags: string[][]): string | undefined {
	return tags.findLast(([name, value]) => name === 'e' && isValidEventId(value))?.[1];
}
