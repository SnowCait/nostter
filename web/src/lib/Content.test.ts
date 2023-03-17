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
		expect(Content.parse('#[0]')).toStrictEqual([new Token('reference', '#[0]', 0)]);
	});
	it('hashtag', () => {
		expect(Content.parse('#nostter')).toStrictEqual([new Token('hashtag', '#nostter')]);
	});
	it('url', () => {
		expect(Content.parse('https://example.com/')).toStrictEqual([
			new Token('url', 'https://example.com/')
		]);
	});

	// Complex
	it('multi lines', () => {
		expect(Content.parse('#[0]\n#nostter')).toStrictEqual([
			new Token('reference', '#[0]', 0),
			new Token('text', '\n'),
			new Token('hashtag', '#nostter')
		]);
	});
	it('multi lines', () => {
		expect(
			Content.parse(
				'#[1] 𠮷#test #nostter #nostr\n#[0] https://example.com/ https://example.com/#tag'
			)
		).toStrictEqual([
			new Token('reference', '#[1]', 1),
			new Token('text', ' 𠮷'),
			new Token('hashtag', '#test'),
			new Token('text', ' '),
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
