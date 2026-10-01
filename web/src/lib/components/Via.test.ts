import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { readable } from 'svelte/store';
import Via from './Via.svelte';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('https://nostter.app/') })
}));

const fooAddress = `31990:${'a'.repeat(64)}:foo`;
const barAddress = `31990:${'a'.repeat(64)}:bar`;
const tags = [
	['client', 'Foo', fooAddress],
	['client', 'Bar', barAddress]
];

function text(html: string): string {
	return html.replace(/<!--.*?-->/g, '');
}

describe('Via', () => {
	it('links only the resolved client name, not the via prefix', () => {
		const { body } = render(Via, {
			props: { tags, clientLinks: new Map([[fooAddress, new URL('https://foo.example/')]]) }
		});
		const [foo, bar] = text(body).split('</div>');

		expect(foo).toMatch(/via <a href="https:\/\/foo\.example\/"[^>]*>Foo<\/a>/);
		expect(bar).toContain('via Bar');
		expect(bar).not.toContain('<a');
	});

	it('renders client names as text without links', () => {
		const { body } = render(Via, { props: { tags } });

		expect(body).not.toContain('<a');
		expect(text(body)).toContain('via Foo');
		expect(text(body)).toContain('via Bar');
	});
});
