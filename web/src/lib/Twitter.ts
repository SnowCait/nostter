export class Twitter {
	static isTweetUrl(url: URL | string): boolean {
		return /^https:\/\/(x|twitter)\.com\/.+\/status\/.+$/.test(
			typeof url === 'string' ? url : url.href
		);
	}
}
