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
	it('reference', () => {
		expect(Content.parse('#[0]', [[]])).toStrictEqual([new Token('reference', '#[0]', 0)]);
	});
	it('hashtag', () => {
		expect(Content.parse('#nostter', [['t', 'nostter']])).toStrictEqual([
			new Token('hashtag', '#nostter')
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
	it('invalid hashtags', () => {
		expect(Content.parse('#nostr', [['t', 'nostter']])).toStrictEqual([
			new Token('text', '#nostr')
		]);
	});
	it('url', () => {
		expect(Content.parse('https://example.com/')).toStrictEqual([
			new Token('url', 'https://example.com/')
		]);
	});
	it('nip', () => {
		expect(Content.parse('NIP-01')).toStrictEqual([new Token('nip', 'NIP-01')]);
	});
	it('nips', () => {
		expect(Content.parse(' NIP-01\nNIP-02')).toStrictEqual([
			new Token('text', ' '),
			new Token('nip', 'NIP-01'),
			new Token('text', '\n'),
			new Token('nip', 'NIP-02')
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
