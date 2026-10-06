import '$lib/platform/browser/polyfills';
import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import {
	observeUnexpectedErrors,
	reportSvelteKitError
} from '$lib/platform/browser/unexpected-error-diagnostics';

export const init: ClientInit = () => {
	observeUnexpectedErrors();
};

export const handleError: HandleClientError = ({ error, status, message }) => {
	// Matches the server hook, which leaves 404s such as unknown routes out of error logs.
	if (status >= 500) {
		reportSvelteKitError(error);
	}
	return { message };
};
