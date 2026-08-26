import { describe, expect, it } from 'vitest';
import { kinds as Kind, type Event } from 'nostr-tools';
import { TextEventComposer } from './TextEventComposer';

describe('TextEventComposer.replyTags', () => {
	it('preserves NIP-28 root, reply, and pubkey tags when replying to a channel message', () => {
		const replyTo: Event = {
			kind: Kind.ChannelMessage,
			pubkey: 'reply-author',
			content: 'channel message',
			tags: [
				['e', 'channel-id', '', 'root'],
				['p', 'channel-creator'],
				['p', 'mentioned-pubkey']
			],
			created_at: 0,
			id: 'reply-id',
			sig: ''
		};

		const tags = new TextEventComposer().replyTags('', replyTo);

		expect(tags).toContainEqual(['e', 'channel-id', '', 'root']);
		expect(tags).toContainEqual(['e', 'reply-id', '', 'reply', 'reply-author']);
		expect(tags).toContainEqual(['p', 'reply-author']);
		expect(tags).toContainEqual(['p', 'channel-creator']);
		expect(tags).toContainEqual(['p', 'mentioned-pubkey']);
	});
});
