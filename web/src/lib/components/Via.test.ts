import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { Handlerinformation } from 'nostr-tools/kinds';
import Via from './Via.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('https://nostter.app/') }
}));

const fooAddress = `${Handlerinformation}:${'a'.repeat(64)}:foo`;
const barAddress = `${Handlerinformation}:${'a'.repeat(64)}:bar`;
const tags = [
	['client', 'Foo', fooAddress],
	['client', 'Bar', barAddress]
];

function renderClients(clientLinks?: ReadonlyMap<string, URL>): string[] {
	return render(Via, { props: { tags, clientLinks } }).body.split('</div>').slice(0, -1);
}

describe('Via', () => {
	it('links only the resolved client name, not the via prefix', () => {
		const [foo, bar] = renderClients(new Map([[fooAddress, new URL('https://foo.example/')]]));

		const anchorStart = foo.indexOf('<a ');
		const anchor = foo.slice(anchorStart, foo.indexOf('</a>'));
		const anchorContent = anchor.slice(anchor.indexOf('>') + 1);
		expect(anchor).toContain('href="https://foo.example/"');
		expect(anchorContent).toContain('Foo');
		expect(anchorContent).not.toContain('via');
		expect(foo.slice(0, anchorStart)).toContain('via ');

		expect(bar).toContain('via ');
		expect(bar).toContain('Bar');
		expect(bar).not.toContain('<a');
	});

	it('renders client names as text without links', () => {
		const clients = renderClients();

		expect(clients).toHaveLength(2);
		for (const client of clients) {
			expect(client).not.toContain('<a');
		}
		expect(clients[0]).toContain('Foo');
		expect(clients[1]).toContain('Bar');
	});
});
