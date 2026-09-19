export function isRelayUrl(value: unknown): value is string {
	if (typeof value !== 'string') return false;

	try {
		const { protocol } = new URL(value);
		return protocol === 'ws:' || protocol === 'wss:';
	} catch {
		return false;
	}
}
