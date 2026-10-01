import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { get } from 'svelte/store';
import { _, addMessages, locale } from 'svelte-i18n';
import en from '$lib/i18n/locales/en.json';
import ja from '$lib/i18n/locales/ja.json';
import { metrics } from '$lib/platform/browser/websocket-metrics';
import WebSocketTraffic from './WebSocketTraffic.svelte';

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
