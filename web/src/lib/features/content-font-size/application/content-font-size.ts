import { WebStorage } from '$lib/WebStorage';

export const contentFontSizes = ['small', 'default', 'large', 'extra-large'] as const;

export type ContentFontSize = (typeof contentFontSizes)[number];

const storageKey = 'preference:content-font-size';

export function parseContentFontSize(value: string | null): ContentFontSize {
	return contentFontSizes.find((size) => size === value) ?? 'default';
}

export function loadContentFontSize(): ContentFontSize {
	return parseContentFontSize(new WebStorage(localStorage).get(storageKey));
}

export function saveContentFontSize(size: ContentFontSize): void {
	new WebStorage(localStorage).set(storageKey, size);
	document.documentElement.dataset.contentFontSize = size;
}
