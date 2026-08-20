export function hasNoteDraft(content: string, hasAttachments: boolean): boolean {
	return content !== '' || hasAttachments;
}
