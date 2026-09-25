/** Extract non-empty values for a Nostr tag name, preserving tag order. */
export function getTagValues(tagName: string, tags: readonly (readonly string[])[]): string[] {
	return tags
		.filter(([name, content]) => name === tagName && content !== undefined && content !== '')
		.map(([, content]) => content);
}
