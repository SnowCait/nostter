import { describe, it, expect } from 'vitest';
import { Content, emojify, type Token } from './Content';

describe('parse test', () => {
	// Basic
	it('empty', () => {
		expect(Content.parse('')).toStrictEqual([] as const satisfies readonly Token[]);
	});
	it('text', () => {
		expect(Content.parse('text')).toStrictEqual([
			{ type: 'text', text: 'text', start: 0 }
		] as const satisfies readonly Token[]);
	});
	it('reference #[index]', () => {
		expect(Content.parse('#[0]')).toStrictEqual([
			{ type: 'reference', text: '#[0]', start: 0, tagIndex: 0 }
		] as const satisfies readonly Token[]);
	});
	it('reference nostr:', () => {
		expect(
			Content.parse('nostr:npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x')
		).toStrictEqual([
			{
				type: 'reference',
				text: 'nostr:npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x',
				start: 0,
				tagIndex: undefined
			}
		] as const satisfies readonly Token[]);
	});
	it('hashtag', () => {
		expect(Content.parse('#nostter', [['t', 'nostter']])).toStrictEqual([
			{ type: 'hashtag', text: '#nostter', start: 0 }
		] as const satisfies readonly Token[]);
		expect(Content.parse('#nostter', [['t', '']])).toStrictEqual([
			{ type: 'text', text: '#nostter', start: 0 }
		] as const satisfies readonly Token[]);
	});
	it('emoji', () => {
		expect(
			Content.parse(':pawprint:', [
				[
					'emoji',
					'pawprint',
					'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png'
				]
			])
		).toStrictEqual([
			{
				type: 'emoji',
				text: ':pawprint:',
				start: 0,
				url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png'
			}
		] as const satisfies readonly Token[]);
	});
	it('multi hashtags', () => {
		expect(
			Content.parse('#nostter #nostr', [
				['t', 'nostter'],
				['t', 'nostr']
			])
		).toStrictEqual([
			{ type: 'hashtag', text: '#nostter', start: 0 },
			{ type: 'text', text: ' ', start: 8 },
			{ type: 'hashtag', text: '#nostr', start: 9 }
		] as const satisfies readonly Token[]);
	});
	it('part hashtags', () => {
		expect(Content.parse('#nostter #nostr', [['t', 'nostter']])).toStrictEqual([
			{ type: 'hashtag', text: '#nostter', start: 0 },
			{ type: 'text', text: ' #nostr', start: 8 }
		] as const satisfies readonly Token[]);
	});
	it('overlap hashtags', () => {
		expect(
			Content.parse('#nostr #nostrich', [
				['t', 'nostr'],
				['t', 'nostrich']
			])
		).toStrictEqual([
			{ type: 'hashtag', text: '#nostr', start: 0 },
			{ type: 'text', text: ' ', start: 6 },
			{ type: 'hashtag', text: '#nostrich', start: 7 }
		] as const satisfies readonly Token[]);
	});
	it('invalid hashtags', () => {
		expect(Content.parse('#nostr', [['t', 'nostter']])).toStrictEqual([
			{ type: 'text', text: '#nostr', start: 0 }
		] as const satisfies readonly Token[]);
	});
	it('url', () => {
		expect(Content.parse('https://example.com/')).toStrictEqual([
			{ type: 'url', text: 'https://example.com/', start: 0 }
		] as const satisfies readonly Token[]);
		expect(Content.parse('http://example.com/')).toStrictEqual([
			{ type: 'url', text: 'http://example.com/', start: 0 }
		] as const satisfies readonly Token[]);
	});
	it('url in JSON', () => {
		expect(Content.parse('{"key":"https://example.com/"}')).toStrictEqual([
			{ type: 'text', text: '{"key":"https://example.com/"}', start: 0 }
		] as const satisfies readonly Token[]);
	});
	it('url', () => {
		expect(Content.parse('(https://example.com/path)')).toStrictEqual([
			{ type: 'text', text: '(', start: 0 },
			{ type: 'url', text: 'https://example.com/path', start: 1 },
			{ type: 'text', text: ')', start: 25 }
		] as const satisfies readonly Token[]);
	});
	it('nip', () => {
		expect(Content.parse('NIP-01')).toStrictEqual([
			{ type: 'nip', text: 'NIP-01', start: 0 }
		] as const satisfies readonly Token[]);
	});
	it('nips', () => {
		expect(Content.parse(' NIP-01\nNIP-02\nNIP-3')).toStrictEqual([
			{ type: 'text', text: ' ', start: 0 },
			{ type: 'nip', text: 'NIP-01', start: 1 },
			{ type: 'text', text: '\n', start: 7 },
			{ type: 'nip', text: 'NIP-02', start: 8 },
			{ type: 'text', text: '\nNIP-3', start: 14 }
		] as const satisfies readonly Token[]);
	});

	// Complex
	it('multi lines', () => {
		expect(Content.parse('#[0]\n#nostter', [[], ['t', 'nostter']])).toStrictEqual([
			{ type: 'reference', text: '#[0]', start: 0, tagIndex: 0 },
			{ type: 'text', text: '\n', start: 4 },
			{ type: 'hashtag', text: '#nostter', start: 5 }
		] as const satisfies readonly Token[]);
	});
	it('multi lines', () => {
		expect(
			Content.parse(
				'#[1] 𠮷#test #nostter #nostr\n#[0] https://example.com/ https://example.com/#tag',
				[[], [], ['t', 'nostter'], ['t', 'nostr']]
			)
		).toStrictEqual([
			{ type: 'reference', text: '#[1]', start: 0, tagIndex: 1 },
			{ type: 'text', text: ' 𠮷#test ', start: 4 },
			{ type: 'hashtag', text: '#nostter', start: 13 },
			{ type: 'text', text: ' ', start: 21 },
			{ type: 'hashtag', text: '#nostr', start: 22 },
			{ type: 'text', text: '\n', start: 28 },
			{ type: 'reference', text: '#[0]', start: 29, tagIndex: 0 },
			{ type: 'text', text: ' ', start: 33 },
			{ type: 'url', text: 'https://example.com/', start: 34 },
			{ type: 'text', text: ' ', start: 54 },
			{ type: 'url', text: 'https://example.com/#tag', start: 55 }
		] as const satisfies readonly Token[]);
	});
});

describe('findNpubsAndNprofiles test', () => {
	it('empty', () => {
		expect(Content.findNpubsAndNprofiles('')).toStrictEqual([]);
	});
	it('npubs', () => {
		expect(
			Content.findNpubsAndNprofiles('npub1aaaaaa nprofile1bbbbbb nostr:npub1cccccc')
		).toStrictEqual(['npub1aaaaaa', 'nprofile1bbbbbb', 'npub1cccccc']);
	});
	it('url', () => {
		expect(Content.findNpubsAndNprofiles('https://example.com/npub1aaaaaa')).toStrictEqual([]);
	});
});

describe('findNotesAndNevents test', () => {
	it('empty', () => {
		expect(Content.findNotesAndNevents('')).toStrictEqual([]);
	});
	it('notes', () => {
		expect(
			Content.findNotesAndNevents('note1aaaaaa nevent1bbbbbb nostr:note1cccccc')
		).toStrictEqual(['note1aaaaaa', 'nevent1bbbbbb', 'note1cccccc']);
	});
	it('url', () => {
		expect(Content.findNpubsAndNprofiles('https://example.com/note1aaaaaa')).toStrictEqual([]);
	});
});

describe('findHashtags test', () => {
	it('empty', () => {
		expect(Content.findHashtags('')).toStrictEqual([]);
	});
	it('hashtag', () => {
		expect(Content.findHashtags('#tag')).toStrictEqual(['tag']);
	});
	it('hashtags', () => {
		expect(
			Content.findHashtags('#tag1 #tag2#tag3 https://example.com/#tag4 #tag5')
		).toStrictEqual(['tag1', 'tag2', 'tag5']);
	});
	it('multi byte hashtags', () => {
		expect(Content.findHashtags('#テスト #てすと #日本語 #テスト1 #テスト_2')).toStrictEqual([
			'テスト',
			'てすと',
			'日本語',
			'テスト1',
			'テスト_2'
		]);
	});
	it('non-hashtag signs', () => {
		expect(
			Content.findHashtags('#tag-test #tag! #tag~ (#tag) #tag！ #tag～ （#tag） #🐾')
		).toStrictEqual(['tag']);
	});
});

describe('replaceNip19 test', () => {
	it('replace', () => {
		expect(
			Content.replaceNip19('npub1aaaaaa nprofile1bbbbbb nostr:note1cccccc nevent1dddddd')
		).toStrictEqual('npub1aaaaaa nprofile1bbbbbb nostr:note1cccccc nostr:nevent1dddddd');
	});
	it('url', () => {
		expect(Content.replaceNip19('https://example.com/npub1aaaaaa')).toStrictEqual(
			'https://example.com/npub1aaaaaa'
		);
	});
});

describe('emojify', () => {
	it('text with unused tags', () => {
		expect(
			emojify('text', [
				[
					'emoji',
					'pawprint',
					'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png'
				]
			])
		).toStrictEqual([
			{ type: 'text', text: 'text', start: 0 }
		] as const satisfies readonly Token[]);
	});
	it('emoji', () => {
		expect(
			emojify('text1 :pawprint::pawprint: text2', [
				[
					'emoji',
					'pawprint',
					'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png'
				]
			])
		).toStrictEqual([
			{ type: 'text', text: 'text1 ', start: 0 },
			{
				type: 'emoji',
				text: ':pawprint:',
				start: 6,
				url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png'
			},
			{
				type: 'emoji',
				text: ':pawprint:',
				start: 16,
				url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png'
			},
			{ type: 'text', text: ' text2', start: 26 }
		] as const satisfies readonly Token[]);
	});
});
