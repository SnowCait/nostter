import '$lib/platform/browser/polyfills';
import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import {
	observeUnexpectedErrors,
	reportSvelteKitHandleError
} from '$lib/platform/browser/unexpected-error-diagnostics';

export const init: ClientInit = () => {
	observeUnexpectedErrors();
};

export const handleError: HandleClientError = ({ message }) => {
	reportSvelteKitHandleError();
	return { message };
};
