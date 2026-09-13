import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Relay from './Relay.svelte';

const relay = { url: 'wss://relay.example.com', read: true, write: true };

describe('Relay', () => {
	it('renders the remove button as type="button" so it does not submit a form', () => {
		const { body } = render(Relay, { props: { relay, readonly: false } });
		expect(body).toMatch(/<button[^>]*type="button"/);
	});

	it('does not render the remove button when readonly', () => {
		const { body } = render(Relay, { props: { relay, readonly: true } });
		expect(body).not.toMatch(/<button/);
	});
});
