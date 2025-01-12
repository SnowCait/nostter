export function isReplaceableKind(kind: number): boolean {
	return [0, 3].includes(kind) || (10000 <= kind && kind < 20000);
}

export function isParameterizedReplaceableKind(kind: number): boolean {
	return 30000 <= kind && kind < 40000;
}
