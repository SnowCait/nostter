export function adjustHeight(textarea: HTMLTextAreaElement): void {
	const { selectionStart, selectionEnd } = textarea;
	if (selectionStart !== selectionEnd) {
		return;
	}

	// In em so that the height keeps following the font size when it changes later
	const lineHeightEm =
		getLineHeight(textarea) / Number.parseFloat(getComputedStyle(textarea).fontSize);
	const linesCount = countLines(textarea.value);
	textarea.style.height = `${(linesCount + 2) * lineHeightEm}em`;
}

/**
 * Used line height in px, approximated by the font size when it is `normal`.
 */
export function getLineHeight(element: HTMLElement): number {
	const { lineHeight, fontSize } = getComputedStyle(element);
	const px = Number.parseFloat(lineHeight);
	return Number.isFinite(px) ? px : Number.parseFloat(fontSize);
}

export function countLines(text: string): number {
	return (text.match(/\n/g)?.length ?? 0) + 1;
}
