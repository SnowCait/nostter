export function chunk<T>(array: readonly T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
		array.slice(i * size, i * size + size)
	);
}

export function diff<T>(array1: readonly T[], array2: readonly T[]): T[] {
	return array1.filter((x) => !array2.includes(x));
}

export function unique<T>(array: readonly T[]): T[] {
	return [...new Set<T>(array)];
}
