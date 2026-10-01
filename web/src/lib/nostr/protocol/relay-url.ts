export function isRelayUrl(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}

	try {
		const { protocol } = new URL(value);
		return protocol === 'ws:' || protocol === 'wss:';
	} catch {
		return false;
	}
}

export function isSecureRelayUrl(value: unknown): value is string {
	return typeof value === 'string' && URL.parse(value)?.protocol === 'wss:';
}
