export interface ContentWarning {
	reason: string | undefined;
}

export function getContentWarning(
	tags: readonly (readonly string[])[]
): ContentWarning | undefined {
	const tag = tags.find(([name]) => name === 'content-warning');
	return tag === undefined ? undefined : { reason: tag[1] };
}
