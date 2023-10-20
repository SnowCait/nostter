export function normalizeNip05(nip05: string): string {
	return nip05.replace(/^_@/, '');
}
