export function adjustHeight(textarea: HTMLTextAreaElement): void {
	const { selectionStart, selectionEnd } = textarea;
	if (selectionStart !== selectionEnd) {
		return;
	}

	const linesCount = countLines(textarea.value);
	textarea.style.height = `${linesCount + 2}rem`;
}

function countLines(text: string): number {
	return (text.match(/\n/g)?.length ?? 0) + 1;
}
