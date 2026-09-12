export function getReactionTargetEventId(tags: string[][]): string | undefined {
	const eventIds = tags
		.filter(([name, value]) => name === 'e' && value !== undefined && value !== '')
		.map(([, value]) => value);
	return eventIds.at(-1);
}
