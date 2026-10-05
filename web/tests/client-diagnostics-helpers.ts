import type { Page } from '@playwright/test';

type SentDiagnostic = { body: Record<string, unknown>; status?: number };

export const recordDiagnostics = (page: Page) =>
	page.addInitScript(() => {
		const sent: SentDiagnostic[] = [];
		Object.assign(window, { sentDiagnostics: sent });
		const fetch = window.fetch;
		window.fetch = (input, init) => {
			if (input !== '/api/diagnostics/client') {
				return fetch(input, init);
			}
			const diagnostic: SentDiagnostic = { body: JSON.parse(String(init?.body)) };
			sent.push(diagnostic);
			return fetch(input, init).then((response) => {
				diagnostic.status = response.status;
				return response;
			});
		};
	});

export const sentDiagnostics = (page: Page) =>
	page.evaluate(
		() => (window as unknown as { sentDiagnostics: SentDiagnostic[] }).sentDiagnostics
	);
