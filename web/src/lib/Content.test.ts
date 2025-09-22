import { describe, it, expect } from 'vitest';
import { Content, Token } from './Content';

describe('parse test', () => {
	// Basic
	it('empty', () => {
		expect(Content.parse('')).toStrictEqual([]);
	});
	it('text', () => {
		expect(Content.parse('text')).toStrictEqual([new Token('text', 'text')]);
	});
	it('reference #[index]', () => {
		expect(Content.parse('#[0]', [[]])).toStrictEqual([new Token('reference', '#[0]', 0)]);
	});
	it('reference nostr:', () => {
		expect(
			Content.parse('nostr:npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x', [
				[]
			])
		).toStrictEqual([
			new Token(
				'reference',
				'nostr:npub19rfhux6gjsmu0rtyendlrazvyr3lqy7m506vy4emy4vehf3s3s3qhhje7x',
				undefined
			)
		]);
	});
	it('hashtag', () => {
		expect(Content.parse('#nostter', [['t', 'nostter']])).toStrictEqual([
			new Token('hashtag', '#nostter')
		]);
		expect(Content.parse('#nostter', [['t', '']])).toStrictEqual([
			new Token('text', '#nostter')
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
				undefined,
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
			new Token('hashtag', '#nostter'),
			new Token('text', ' '),
			new Token('hashtag', '#nostr')
		]);
	});
	it('part hashtags', () => {
		expect(Content.parse('#nostter #nostr', [['t', 'nostter']])).toStrictEqual([
			new Token('hashtag', '#nostter'),
			new Token('text', ' #nostr')
		]);
	});
	it('overlap hashtags', () => {
		expect(
			Content.parse('#nostr #nostrich', [
				['t', 'nostr'],
				['t', 'nostrich']
			])
		).toStrictEqual([
			new Token('hashtag', '#nostr'),
			new Token('text', ' '),
			new Token('hashtag', '#nostrich')
		]);
	});
	it('invalid hashtags', () => {
		expect(Content.parse('#nostr', [['t', 'nostter']])).toStrictEqual([
			new Token('text', '#nostr')
		]);
	});
	it('url', () => {
		expect(Content.parse('https://example.com/')).toStrictEqual([
			new Token('url', 'https://example.com/')
		]);
		expect(Content.parse('http://example.com/')).toStrictEqual([
			new Token('url', 'http://example.com/')
		]);
	});
	it('url in JSON', () => {
		expect(Content.parse('{"key":"https://example.com/"}')).toStrictEqual([
			new Token('text', '{"key":"https://example.com/"}')
		]);
	});
	// it('url', () => {
	// 	expect(Content.parse('(https://example.com/path)')).toStrictEqual([
	// 		new Token('text', '('),
	// 		new Token('url', 'https://example.com/path'),
	// 		new Token('text', ')')
	// 	]);
	// });
	it('nip', () => {
		expect(Content.parse('NIP-01')).toStrictEqual([new Token('nip', 'NIP-01')]);
	});
	it('nips', () => {
		expect(Content.parse(' NIP-01\nNIP-02\nNIP-3')).toStrictEqual([
			new Token('text', ' '),
			new Token('nip', 'NIP-01'),
			new Token('text', '\n'),
			new Token('nip', 'NIP-02'),
			new Token('text', '\nNIP-3')
		]);
	});

	// Complex
	it('multi lines', () => {
		expect(Content.parse('#[0]\n#nostter', [[], ['t', 'nostter']])).toStrictEqual([
			new Token('reference', '#[0]', 0),
			new Token('text', '\n'),
			new Token('hashtag', '#nostter')
		]);
	});
	it('multi lines', () => {
		expect(
			Content.parse(
				'#[1] 𠮷#test #nostter #nostr\n#[0] https://example.com/ https://example.com/#tag',
				[[], [], ['t', 'nostter'], ['t', 'nostr']]
			)
		).toStrictEqual([
			new Token('reference', '#[1]', 1),
			new Token('text', ' 𠮷#test '),
			new Token('hashtag', '#nostter'),
			new Token('text', ' '),
			new Token('hashtag', '#nostr'),
			new Token('text', '\n'),
			new Token('reference', '#[0]', 0),
			new Token('text', ' '),
			new Token('url', 'https://example.com/'),
			new Token('text', ' '),
			new Token('url', 'https://example.com/#tag')
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
