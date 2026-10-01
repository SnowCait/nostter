import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { get } from 'svelte/store';
import { _, addMessages, locale } from 'svelte-i18n';
import en from '$lib/i18n/locales/en.json';
import ja from '$lib/i18n/locales/ja.json';
import { metrics } from '$lib/platform/browser/websocket-metrics';
import type { WebSocketMetricsSnapshot } from 'websocket-metrics';
import WebSocketTraffic from './WebSocketTraffic.svelte';

const mocks = vi.hoisted(() => ({
	snapshot: undefined as WebSocketMetricsSnapshot | undefined,
	readRelays: [] as string[]
}));

// SSR never runs onMount, so run it during render to apply the mocked metrics subscription.
vi.mock('svelte', async (importOriginal) => ({
	...(await importOriginal<typeof import('svelte')>()),
	onMount: (fn: () => void) => fn()
}));

vi.mock('$lib/platform/browser/websocket-metrics', () => ({
	get metrics() {
		const snapshot = mocks.snapshot;
		return snapshot === undefined
			? undefined
			: {
					subscribe: (listener: (s: WebSocketMetricsSnapshot) => void) =>
						listener(snapshot)
				};
	}
}));

vi.mock('$lib/RxNostrHelper', () => ({
	getDefaultReadRelays: () => mocks.readRelays
}));

beforeEach(() => {
	mocks.snapshot = undefined;
	mocks.readRelays = [];
});

function traffic(received: number, sent: number) {
	return {
		received: { bytes: received, messages: 1 },
		sent: { bytes: sent, messages: 1 }
	};
}

function renderWith(byKey: WebSocketMetricsSnapshot['byKey'], readRelays: string[]) {
	mocks.snapshot = { total: traffic(0, 0), byKey };
	mocks.readRelays = readRelays;
	const body = render(WebSocketTraffic).body;
	const detailsIndex = body.indexOf('<details');
	const urls = [...body.matchAll(/<h4 class="url[^"]*">([^<]+)<\/h4>/g)];
	return {
		body,
		subscribed: urls.filter((m) => detailsIndex < 0 || m.index < detailsIndex).map((m) => m[1]),
		others: urls.filter((m) => detailsIndex >= 0 && m.index > detailsIndex).map((m) => m[1])
	};
}

beforeAll(() => {
	addMessages('en', en);
	addMessages('ja', ja);
});

describe('WebSocket traffic message counts', () => {
	it.each([
		['en', 0, '0 messages'],
		['en', 1, '1 message'],
		['en', 2, '2 messages'],
		['en', 1234, '1,234 messages'],
		['ja', 0, '0 メッセージ'],
		['ja', 1, '1 メッセージ'],
		['ja', 2, '2 メッセージ'],
		['ja', 1234, '1,234 メッセージ']
	])('formats %s message count %i as %s', (lang, count, expected) => {
		locale.set(lang);
		expect(get(_)('preferences.websocket_traffic.messages', { values: { count } })).toBe(
			expected
		);
	});
});

describe('WebSocket traffic SSR', () => {
	it.each([
		['en', 'Total', '0 messages', 'No WebSocket traffic yet.'],
		['ja', '合計', '0 メッセージ', 'まだ WebSocket 通信はありません。']
	])(
		'renders zero totals and an empty state in %s without a browser collector',
		(lang, total, messages, empty) => {
			locale.set(lang);
			expect(metrics).toBeUndefined();
			const body = render(WebSocketTraffic).body;
			expect(body).toContain(total);
			expect(body).toContain('0 B');
			expect(body).toContain(messages);
			expect(body).toContain(empty);
		}
	);
});

describe('WebSocket traffic relay groups', () => {
	beforeEach(() => locale.set('en'));

	it('shows subscription relays and collapses other relays, each sorted by total bytes', () => {
		const { body, subscribed, others } = renderWith(
			{
				'wss://a.example/': traffic(10, 0),
				'wss://b.example/': traffic(5, 25),
				'wss://c.example/': traffic(20, 0),
				'wss://x.example/': traffic(1, 1),
				'wss://y.example/': traffic(0, 100),
				'wss://z.example/': traffic(50, 0)
			},
			['wss://a.example/', 'wss://b.example/', 'wss://c.example/']
		);
		expect(subscribed).toEqual(['wss://b.example/', 'wss://c.example/', 'wss://a.example/']);
		expect(others).toEqual(['wss://y.example/', 'wss://z.example/', 'wss://x.example/']);
		expect(body).toContain('Other relays (3)');
		expect(body).not.toMatch(/<details[^>]*open/);
	});

	it('orders relays with the same total bytes by URL', () => {
		const { subscribed, others } = renderWith(
			{
				'wss://b.example/': traffic(10, 0),
				'wss://a.example/': traffic(0, 10),
				'wss://d.example/': traffic(3, 4),
				'wss://c.example/': traffic(4, 3)
			},
			['wss://a.example/', 'wss://b.example/']
		);
		expect(subscribed).toEqual(['wss://a.example/', 'wss://b.example/']);
		expect(others).toEqual(['wss://c.example/', 'wss://d.example/']);
	});

	it('omits the collapsed section when every relay is a subscription relay', () => {
		const { body, subscribed } = renderWith({ 'wss://a.example/': traffic(1, 0) }, [
			'wss://a.example/'
		]);
		expect(subscribed).toEqual(['wss://a.example/']);
		expect(body).not.toContain('<details');
	});

	it('does not show the empty state when only other relays have traffic', () => {
		const { body, subscribed, others } = renderWith({ 'wss://x.example/': traffic(1, 0) }, []);
		expect(subscribed).toEqual([]);
		expect(others).toEqual(['wss://x.example/']);
		expect(body).not.toContain('No WebSocket traffic yet.');
	});
});
