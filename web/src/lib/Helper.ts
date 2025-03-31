export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const newUrl = (url: string): URL | undefined =>
	URL.canParse(url) ? new URL(url) : undefined;

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

const date = new Date();
export const isAprilFool = date.getMonth() === 3 && date.getDate() === 1;
