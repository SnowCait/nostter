import { describe, it, expect } from 'vitest';
import { Content, Token } from './Content';

describe('parse test', () => {
	// Basic
	it('empty', () => {
		const content = new Content('');
		expect(content.parse()).toStrictEqual([]);
	});
	it('text', () => {
		const content = new Content('text');
		expect(content.parse()).toStrictEqual([new Token('text', 'text')]);
	});
	it('ref', () => {
		const content = new Content('#[0]');
		expect(content.parse()).toStrictEqual([new Token('ref', '#[0]', 0)]);
	});
	it('hashtag', () => {
		const content = new Content('#nostter');
		expect(content.parse()).toStrictEqual([new Token('hashtag', '#nostter')]);
	});
	it('url', () => {
		const content = new Content('https://example.com/');
		expect(content.parse()).toStrictEqual([new Token('url', 'https://example.com/')]);
	});

	// Complex
	it('multi lines', () => {
		const content = new Content('#[0]\n#nostter');
		expect(content.parse()).toStrictEqual([
			new Token('ref', '#[0]', 0),
			new Token('text', '\n'),
			new Token('hashtag', '#nostter')
		]);
	});
	it('multi lines', () => {
		const content = new Content(
			'#[1] 𠮷#test #nostter #nostr\n#[0] https://example.com/ https://example.com/#tag'
		);
		expect(content.parse()).toStrictEqual([
			new Token('ref', '#[1]', 1),
			new Token('text', ' 𠮷'),
			new Token('hashtag', '#test'),
			new Token('text', ' '),
			new Token('hashtag', '#nostter'),
			new Token('text', ' '),
			new Token('hashtag', '#nostr'),
			new Token('text', '\n'),
			new Token('ref', '#[0]', 0),
			new Token('text', ' '),
			new Token('url', 'https://example.com/'),
			new Token('text', ' '),
			new Token('url', 'https://example.com/#tag')
		]);
	});
});
