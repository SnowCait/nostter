import { describe, it, expect } from 'vitest';
import { Content, Token } from './Content';

describe('parse test', () => {
	// Basic
	it('empty', () => {
		expect(Content.parse('')).toStrictEqual([]);
	});
	it('text', () => {
		expect(Content.parse('text')).toStrictEqual([new Token('text', 'text', 0)]);
	});
	it('reference #[index]', () => {
		expect(Content.parse('#[0]')).toStrictEqual([new Token('reference', '#[0]', 0)]);
	});
	it('reference nostr:', () => {
		expect(
			Content.parse('nostr:npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x')
		).toStrictEqual([
			new Token(
				'reference',
				'nostr:npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x',
				0
			)
		]);
	});
	it('hashtag', () => {
		expect(Content.parse('#nostter', [['t', 'nostter']])).toStrictEqual([
			new Token('hashtag', '#nostter', 0)
		]);
		expect(Content.parse('#nostter', [['t', '']])).toStrictEqual([
			new Token('text', '#nostter', 0)
		]);
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
			new Token(
				'emoji',
				':pawprint:',
				0,
				'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43e.png'
			)
		]);
	});
	it('multi hashtags', () => {
		expect(
			Content.parse('#nostter #nostr', [
				['t', 'nostter'],
				['t', 'nostr']
			])
		).toStrictEqual([
			new Token('hashtag', '#nostter', 0),
			new Token('text', ' ', 8),
			new Token('hashtag', '#nostr', 9)
		]);
	});
	it('part hashtags', () => {
		expect(Content.parse('#nostter #nostr', [['t', 'nostter']])).toStrictEqual([
			new Token('hashtag', '#nostter', 0),
			new Token('text', ' #nostr', 8)
		]);
	});
	it('overlap hashtags', () => {
		expect(
			Content.parse('#nostr #nostrich', [
				['t', 'nostr'],
				['t', 'nostrich']
			])
		).toStrictEqual([
			new Token('hashtag', '#nostr', 0),
			new Token('text', ' ', 6),
			new Token('hashtag', '#nostrich', 7)
		]);
	});
	it('invalid hashtags', () => {
		expect(Content.parse('#nostr', [['t', 'nostter']])).toStrictEqual([
			new Token('text', '#nostr', 0)
		]);
	});
	it('url', () => {
		expect(Content.parse('https://example.com/')).toStrictEqual([
			new Token('url', 'https://example.com/', 0)
		]);
		expect(Content.parse('http://example.com/')).toStrictEqual([
			new Token('url', 'http://example.com/', 0)
		]);
	});
	it('url in JSON', () => {
		expect(Content.parse('{"key":"https://example.com/"}')).toStrictEqual([
			new Token('text', '{"key":"https://example.com/"}', 0)
		]);
	});
	it('url', () => {
		expect(Content.parse('(https://example.com/path)')).toStrictEqual([
			new Token('text', '(', 0),
			new Token('url', 'https://example.com/path', 1),
			new Token('text', ')', 25)
		]);
	});
	it('nip', () => {
		expect(Content.parse('NIP-01')).toStrictEqual([new Token('nip', 'NIP-01', 0)]);
	});
	it('nips', () => {
		expect(Content.parse(' NIP-01\nNIP-02\nNIP-3')).toStrictEqual([
			new Token('text', ' ', 0),
			new Token('nip', 'NIP-01', 1),
			new Token('text', '\n', 7),
			new Token('nip', 'NIP-02', 8),
			new Token('text', '\nNIP-3', 14)
		]);
	});

	// Complex
	it('multi lines', () => {
		expect(Content.parse('#[0]\n#nostter', [[], ['t', 'nostter']])).toStrictEqual([
			new Token('reference', '#[0]', 0),
			new Token('text', '\n', 4),
			new Token('hashtag', '#nostter', 5)
		]);
	});
	it('multi lines', () => {
		expect(
			Content.parse(
				'#[1] 𠮷#test #nostter #nostr\n#[0] https://example.com/ https://example.com/#tag',
				[[], [], ['t', 'nostter'], ['t', 'nostr']]
			)
		).toStrictEqual([
			new Token('reference', '#[1]', 0),
			new Token('text', ' 𠮷#test ', 4),
			new Token('hashtag', '#nostter', 13),
			new Token('text', ' ', 21),
			new Token('hashtag', '#nostr', 22),
			new Token('text', '\n', 28),
			new Token('reference', '#[0]', 29),
			new Token('text', ' ', 33),
			new Token('url', 'https://example.com/', 34),
			new Token('text', ' ', 54),
			new Token('url', 'https://example.com/#tag', 55)
		]);
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
