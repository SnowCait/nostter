export function chunk<T>(array: T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
		array.slice(i * size, i * size + size)
	);
}

export function diff<T>(array1: T[], array2: T[]): T[] {
	return array1.filter((x) => !array2.includes(x));
}

export function unique<T>(array: T[]): T[] {
	return [...new Set<T>(array)];
}
