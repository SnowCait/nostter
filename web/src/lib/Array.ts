export function chunk<T>(array: T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
		array.slice(i * size, i * size + size)
	);
}
