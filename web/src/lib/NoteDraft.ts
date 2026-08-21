export function hasNoteDraft(content: string, hasAttachments: boolean): boolean {
	return content !== '' || hasAttachments;
}

export function canCloseNoteDraft(
	content: string,
	hasAttachments: boolean,
	busy: boolean,
	confirmClose: () => boolean
): boolean {
	if (busy) return false;
	return !hasNoteDraft(content, hasAttachments) || confirmClose();
}
