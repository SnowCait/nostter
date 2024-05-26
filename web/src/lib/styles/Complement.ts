import type { Action } from 'svelte/action';
import { countLines } from './Textarea';

export const complementPosition: Action<HTMLUListElement, HTMLTextAreaElement> = (ul, textarea) => {
	console.debug('[complement position mount]', ul, textarea);

	const { selectionStart } = textarea;
	const linesCount = countLines(textarea.value.substring(0, selectionStart));

	const rect = textarea.getBoundingClientRect();
	console.debug('[complement position]', rect.top, textarea.scrollTop, linesCount);
	ul.style.top = `calc(${rect.top - textarea.scrollTop}px + ${linesCount}rem)`;
};
