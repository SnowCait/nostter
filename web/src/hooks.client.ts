import { newUrl } from '$lib/Helper';

if (!URL.canParse) {
	URL.canParse = (url: string) => newUrl(url) !== undefined;
}
