export function getCodePoints(text: string): number[] {
	return Array.from(text)
		.map((x) => x.codePointAt(0))
		.filter((x): x is number => x !== undefined);
}
