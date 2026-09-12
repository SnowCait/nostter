import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import Content from './Content.svelte';
import OnelineContent from './OnelineContent.svelte';

vi.mock('$app/stores', () => ({
	page: {
		subscribe: (run: (value: { url: URL }) => void) => {
			run({ url: new URL('https://nostter.app/') });
			return () => undefined;
		}
	}
}));

const nip57Url = 'https://github.com/nostr-protocol/nips/blob/master/57.md';

afterEach(() => vi.unstubAllGlobals());

describe.each([
	['Content', Content],
	['OnelineContent', OnelineContent]
])('%s NIP links', (_, component) => {
	it('renders the NIP label and specification URL without URL preview requests', () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);

		const { body } = render(component, { props: { content: 'NIP-57', tags: [] } });

		expect(body).toContain('NIP-57');
		expect(body).toContain(`href="${nip57Url}"`);
		expect(fetch).not.toHaveBeenCalled();
	});
});
