/** Return a canonical relay URL, or undefined when nostter cannot use it. */
export function normalizeRelayUrl(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	try {
		const url = new URL(value);
		if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return undefined;
		if (url.protocol === 'ws:') {
			const hostname = url.hostname.replace(/\.$/, '');
			// URL parsing canonicalizes IPv4 (including shortened/numeric forms) and IPv6.
			const loopback =
				hostname === 'localhost' ||
				hostname.endsWith('.localhost') ||
				/^127\.\d+\.\d+\.\d+$/.test(hostname) ||
				hostname === '[::1]';
			if (!loopback) return undefined;
		}
		return url.href;
	} catch {
		return undefined;
	}
}

export function normalizeRelayUrls(values: readonly unknown[]): string[] {
	return values.map(normalizeRelayUrl).filter((url) => url !== undefined);
}
