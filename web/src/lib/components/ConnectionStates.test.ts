import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { writable } from 'svelte/store';
import { addMessages, locale } from 'svelte-i18n';
import type { ConnectionState } from 'rx-nostr';
import en from '$lib/i18n/locales/en.json';
import ja from '$lib/i18n/locales/ja.json';
import ConnectionStates from './ConnectionStates.svelte';

const mocks = vi.hoisted(() => ({
	readRelays: [] as string[]
}));

const connectionStates = writable(new Map<string, ConnectionState>());

vi.mock('$lib/timelines/MainTimeline', () => ({
	get connectionStates() {
		return connectionStates;
	}
}));

vi.mock('$lib/RxNostrHelper', () => ({
	getDefaultReadRelays: () => mocks.readRelays
}));

beforeAll(() => {
	addMessages('en', en);
	addMessages('ja', ja);
});

beforeEach(() => {
	locale.set('en');
	mocks.readRelays = [];
	connectionStates.set(new Map());
});

function renderWith(states: [string, ConnectionState][], readRelays: string[]) {
	connectionStates.set(new Map(states));
	mocks.readRelays = readRelays;
	const body = render(ConnectionStates).body;
	const detailsIndex = body.indexOf('<details');
	const items = [...body.matchAll(/<li class="([^"]*)" title="([^"]*)">\s*([^<\s]+)\s*<\/li>/g)];
	const toEntry = (m: RegExpMatchArray) => ({
		url: m[3],
		state: m[2],
		group: m[1].split(' ')[0]
	});
	return {
		body,
		subscribed: items.filter((m) => detailsIndex < 0 || m.index < detailsIndex).map(toEntry),
		others: items.filter((m) => detailsIndex >= 0 && m.index > detailsIndex).map(toEntry)
	};
}

describe('ConnectionStates relay groups', () => {
	it('shows subscription relays and collapses other relays, keeping each state and the Map order', () => {
		const { body, subscribed, others } = renderWith(
			[
				['wss://z.example', 'error'],
				['wss://b.example', 'connected'],
				['wss://y.example', 'connecting'],
				['wss://a.example', 'retrying'],
				['wss://x.example', 'connected']
			],
			['wss://a.example/', 'wss://b.example/', 'wss://z.example/']
		);
		expect(subscribed).toEqual([
			{ url: 'wss://z.example/', state: 'error', group: 'error' },
			{ url: 'wss://b.example/', state: 'connected', group: 'success' },
			{ url: 'wss://a.example/', state: 'retrying', group: 'pending' }
		]);
		expect(others).toEqual([
			{ url: 'wss://y.example/', state: 'connecting', group: 'pending' },
			{ url: 'wss://x.example/', state: 'connected', group: 'success' }
		]);
		expect(body).toContain('Other relays (2)');
		expect(body).not.toMatch(/<details[^>]*open/);
	});

	it('shows the other relays count in Japanese', () => {
		locale.set('ja');
		const { body } = renderWith([['wss://x.example/', 'connected']], []);
		expect(body).toContain('その他のリレー 1 件');
	});

	it('omits the collapsed section when every relay is a subscription relay', () => {
		const { body, subscribed } = renderWith(
			[['wss://a.example/', 'connected']],
			['wss://a.example/']
		);
		expect(subscribed.map(({ url }) => url)).toEqual(['wss://a.example/']);
		expect(body).not.toContain('<details');
	});
});
