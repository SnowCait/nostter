import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { Event } from 'nostr-tools';
import Nip94 from './Nip94.svelte';

function renderUrl(url: string | undefined, mime = 'image/png'): string {
	const event: Event = {
		kind: 1063,
		id: '',
		pubkey: '',
		sig: '',
		created_at: 0,
		content: 'description',
		tags: [...(url === undefined ? [] : [['url', url]]), ['m', mime]]
	};
	return render(Nip94, { props: { event } }).body;
}

describe('Nip94 URL rendering', () => {
	it('renders an HTTP image as a link using the parsed URL', () => {
		const body = renderUrl('https://example.com');
		expect(body).toContain('href="https://example.com/"');
		expect(body).toContain('src="https://example.com/"');
		expect(body).toContain('alt="description"');
		expect(body).toContain('loading="lazy"');
		expect(body).toContain('decoding="async"');
		expect(body).toContain('target="_blank"');
		expect(body).toContain('rel="noopener noreferrer"');
	});

	it('renders an image data URL without a link', () => {
		const body = renderUrl('data:image/png;base64,AAAA');
		expect(body).toContain('src="data:image/png;base64,AAAA"');
		expect(body).not.toContain('<a ');
	});

	it('renders a non-image HTTP URL as a text link', () => {
		const body = renderUrl('https://example.com', 'application/pdf');
		expect(body).toContain('href="https://example.com/"');
		expect(body).toContain('>https://example.com</a>');
		expect(body).not.toContain('<img');
	});

	it.each(['javascript:alert(1)', 'data:text/html,hello', 'not a URL'])(
		'renders %s as text',
		(url) => {
			const body = renderUrl(url);
			expect(body).toContain(url);
			expect(body).not.toContain('<a ');
			expect(body).not.toContain('<img');
		}
	);

	it('renders no link or image when the URL tag is absent', () => {
		const body = renderUrl(undefined);
		expect(body).not.toContain('<a ');
		expect(body).not.toContain('<img');
	});
});
