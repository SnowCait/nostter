import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { get, writable } from 'svelte/store';
import type { AccountLocalPreferences } from '$lib/preferences/AccountLocalPreferences';

const { preferencesByPubkey } = vi.hoisted(() => ({
	preferencesByPubkey: new Map<string, ReturnType<typeof writable<AccountLocalPreferences>>>()
}));

vi.mock('$lib/preferences/AccountLocalPreferences', () => ({
	getAccountLocalPreferences: (pubkey: string) => {
		let preferences = preferencesByPubkey.get(pubkey);
		if (preferences === undefined) {
			preferences = writable({});
			preferencesByPubkey.set(pubkey, preferences);
		}
		return preferences;
	}
}));

import {
	blossomServer,
	resolveBlossomServer,
	updateBlossomServerList,
	withBlossomServer
} from './BlossomServerList';

const serverList = (tags: string[][]): Event =>
	({ kind: 10063, tags, content: '', created_at: 0, id: '', pubkey: '', sig: '' }) as Event;

describe('resolveBlossomServer', () => {
	it('selects the first HTTPS server in SDK-parsed tag order', () => {
		const event = serverList([
			['server', 'not a URL'],
			['server', 'http://insecure.example'],
			['server', 'https://first.example/path'],
			['server', 'https://second.example']
		]);
		expect(resolveBlossomServer(event).href).toBe('https://first.example/');
	});

	it('does not select HTTP and falls back when no HTTPS server exists', () => {
		expect(resolveBlossomServer(serverList([['server', 'http://insecure.example']])).href).toBe(
			'https://blossom.band/'
		);
	});
});

describe('Blossom server list state', () => {
	beforeEach(() => {
		preferencesByPubkey.clear();
		blossomServer.set(undefined);
	});

	it('updates the persisted server while Blossom is selected', () => {
		expect(
			withBlossomServer(
				{
					mediaUploader: { type: 'blossom', server: 'https://blossom.band' },
					futurePreference: true
				} as never,
				new URL('https://cdn.example.com')
			)
		).toEqual({
			mediaUploader: { type: 'blossom', server: 'https://cdn.example.com/' },
			futurePreference: true
		});
	});

	it('persists the fallback after receiving a list with no valid HTTPS server', () => {
		expect(
			withBlossomServer(
				{ mediaUploader: { type: 'blossom', server: 'https://previous.example' } },
				resolveBlossomServer(
					serverList([
						['server', 'not a URL'],
						['server', 'http://insecure.example']
					])
				)
			).mediaUploader
		).toEqual({ type: 'blossom', server: 'https://blossom.band/' });
	});

	it('does not switch a NIP-96 selection to Blossom', () => {
		const preferences = {
			mediaUploader: { type: 'nip96' as const, server: 'https://nostr.build' }
		};
		expect(withBlossomServer(preferences, new URL('https://cdn.example.com'))).toBe(
			preferences
		);
	});

	it.each(['cached', 'live'])('uses the same update entry point for a %s event', (source) => {
		const pubkey = `${source}-account`;
		preferencesByPubkey.set(
			pubkey,
			writable({ mediaUploader: { type: 'blossom', server: 'https://previous.example' } })
		);
		updateBlossomServerList(pubkey, serverList([['server', `https://${source}.example`]]));
		expect(get(blossomServer)?.href).toBe(`https://${source}.example/`);
		expect(get(preferencesByPubkey.get(pubkey)!)).toEqual({
			mediaUploader: { type: 'blossom', server: `https://${source}.example/` }
		});
	});

	it('updates memory but preserves a NIP-96 selection and server', () => {
		const preferences = writable<AccountLocalPreferences>({
			mediaUploader: { type: 'nip96', server: 'https://nostr.build' }
		});
		preferencesByPubkey.set('alice', preferences);
		updateBlossomServerList('alice', serverList([['server', 'https://cdn.example.com']]));
		expect(get(blossomServer)?.href).toBe('https://cdn.example.com/');
		expect(get(preferences)).toEqual({
			mediaUploader: { type: 'nip96', server: 'https://nostr.build' }
		});
	});

	it('clears memory for an undefined event without overwriting the last-known server', () => {
		const preferences = writable<AccountLocalPreferences>({
			mediaUploader: { type: 'blossom', server: 'https://previous.example' }
		});
		preferencesByPubkey.set('alice', preferences);
		blossomServer.set(new URL('https://current.example'));
		updateBlossomServerList('alice', undefined);
		expect(get(blossomServer)).toBeUndefined();
		expect(get(preferences)).toEqual({
			mediaUploader: { type: 'blossom', server: 'https://previous.example' }
		});
	});
});
