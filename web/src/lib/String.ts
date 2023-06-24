export function getCodePoints(text: string): number[] {
	const codePoints: number[] = [];
	let i = 0;
	while (i < text.length) {
		const codePoint = text.codePointAt(i);
		if (codePoint === undefined) {
			break;
		}
		codePoints.push(codePoint);
		i += String.fromCodePoint(codePoint).length;
	}
	return codePoints;
}
