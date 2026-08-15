import { describe, expect, it } from 'vitest';
import type { Event } from 'nostr-tools';
import { withBlossomServer } from './BlossomServerList';

const serverList = (tags: string[][]): Event =>
	({ kind: 10063, tags, content: '', created_at: 0, id: '', pubkey: '', sig: '' }) as Event;

describe('withBlossomServer', () => {
	it('updates the persisted server while Blossom is selected', () => {
		expect(
			withBlossomServer(
				{
					mediaUploader: { type: 'blossom', server: 'https://blossom.band' },
					futurePreference: true
				} as never,
				serverList([['server', 'https://cdn.example.com']])
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
				serverList([
					['server', 'not a URL'],
					['server', 'http://insecure.example']
				])
			).mediaUploader
		).toEqual({ type: 'blossom', server: 'https://blossom.band/' });
	});

	it('does not switch a NIP-96 selection to Blossom', () => {
		const preferences = {
			mediaUploader: { type: 'nip96' as const, server: 'https://nostr.build' }
		};
		expect(
			withBlossomServer(preferences, serverList([['server', 'https://cdn.example.com']]))
		).toBe(preferences);
	});
});
