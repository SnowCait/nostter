const expirationRegexp = /^\d+$/;

export function getExpiration(tags: readonly (readonly string[])[]): number | undefined {
	const value = tags.find(([name]) => name === 'expiration')?.at(1);
	if (value === undefined || !expirationRegexp.test(value)) {
		return undefined;
	}
	return Number(value);
}

export function isExpiredAt(expiration: number | undefined, now: number): boolean {
	return expiration !== undefined && expiration <= now;
}
