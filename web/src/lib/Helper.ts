export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const newUrl = (url: string): URL | undefined => {
	try {
		return new URL(url);
	} catch (error) {
		console.log('[invalid url]', url, error);
	}
};

export const fetchMinutes = (numberOfPubkeys: number): number => {
	if (numberOfPubkeys < 10) {
		return 24 * 60;
	} else if (numberOfPubkeys < 25) {
		return 12 * 60;
	} else if (numberOfPubkeys < 50) {
		return 60;
	} else {
		return 15;
	}
};
