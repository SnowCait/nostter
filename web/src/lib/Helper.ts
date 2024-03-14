export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const newUrl = (url: string): URL | undefined => {
	try {
		return new URL(url);
	} catch (error) {
		console.log('[invalid url]', url, error);
	}
};
