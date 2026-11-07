import { googleTranslationUrl } from './google-translation';
import {
	npubEncode,
	nprofileEncode,
	noteEncode,
	neventEncode,
	naddrEncode
} from 'nostr-tools/nip19';
import en from '$lib/i18n/locales/en.json';
import ja from '$lib/i18n/locales/ja.json';
import { describe, expect, it, vi } from 'vitest';
import {
	preferredTranslationLanguage,
	shouldOfferTranslation,
	translateInBrowser,
	type TranslationApis,
	type Availability
} from './browser-translation';

function fixture(availability: Availability = 'available', language = 'en', confidence = 0.99) {
	const detector = {
		detect: vi.fn(async () => [{ detectedLanguage: language, confidence }]),
		destroy: vi.fn()
	};
	const translator = {
		translate: vi.fn<(text: string, options?: { signal?: AbortSignal }) => Promise<string>>(
			async () => '<script>translated</script>'
		),
		destroy: vi.fn()
	};
	const api: TranslationApis = {
		LanguageDetector: {
			availability: vi.fn(async () => availability),
			create: vi.fn(async () => detector)
		},
		Translator: {
			availability: vi.fn(async () => 'available' as const),
			create: vi.fn(async () => translator)
		}
	};
	return { api, detector, translator };
}
describe('browser translation', () => {
	it('hides the control and avoids model creation when detection availability is unknown', async () => {
		const { api } = fixture(null);
		expect(await shouldOfferTranslation(api, 'Hello', 'ja')).toBe(false);
		expect(api.LanguageDetector.create).not.toHaveBeenCalled();
		const prepare = vi.fn();
		await expect(
			translateInBrowser(api, 'Hello', 'ja', {
				getDisplayName: () => undefined,
				prepare,
				translating: () => {},
				signal: new AbortController().signal
			})
		).rejects.toThrow('unavailable');
		expect(prepare).not.toHaveBeenCalled();
	});
	it('does not offer or execute translation for an unknown language pair', async () => {
		const { api } = fixture();
		api.Translator.availability = vi.fn(async () => null);
		expect(await shouldOfferTranslation(api, 'Hello', 'ja')).toBe(false);
		const translating = vi.fn();
		await expect(
			translateInBrowser(api, 'Hello', 'ja', {
				getDisplayName: () => undefined,
				prepare: (_, create) => create(),
				translating,
				signal: new AbortController().signal
			})
		).rejects.toThrow('unavailable');
		expect(api.Translator.create).not.toHaveBeenCalled();
		expect(translating).not.toHaveBeenCalled();
	});

	it.each([
		['ja-JP', 'ja'],
		['en-US', 'en'],
		['fr-FR', 'fr'],
		['zh-CN', 'zh'],
		['zh-SG', 'zh'],
		['zh-Hans', 'zh'],
		['zh-TW', 'zh-Hant'],
		['zh-HK', 'zh-Hant'],
		['zh-Hant-TW', 'zh-Hant'],
		['sr-Latn-RS', 'sr-Latn']
	])('uses the browser preference %s as %s', (tag, expected) => {
		expect(preferredTranslationLanguage({ languages: [tag, 'en'], language: 'en' })).toBe(
			expected
		);
	});
	it('uses navigator.language only when the preference list is empty and never guesses', () => {
		expect(preferredTranslationLanguage({ languages: [], language: 'fr-FR' })).toBe('fr');
		expect(preferredTranslationLanguage({ languages: [] })).toBeUndefined();
	});
	it.each([
		['en-US', 'en'],
		['zh-Hans', 'zh'],
		['zh-TW', 'zh-Hant']
	])('does not offer translation for normalized matching source %s', async (source, target) => {
		const { api } = fixture('available', source);
		expect(await shouldOfferTranslation(api, 'Text', target)).toBe(false);
		expect(api.Translator.availability).not.toHaveBeenCalled();
	});
	it('keeps simplified and traditional Chinese as different language pairs', async () => {
		const { api } = fixture('available', 'zh-Hans');
		expect(await shouldOfferTranslation(api, 'Text', 'zh-Hant')).toBe(true);
		await translateInBrowser(api, 'Text', 'zh-Hant', {
			getDisplayName: () => undefined,
			prepare: (_, create) => create(),
			translating: () => {},
			signal: new AbortController().signal
		});
		expect(api.Translator.create).toHaveBeenCalledWith(
			expect.objectContaining({
				sourceLanguage: 'zh',
				targetLanguage: 'zh-Hant'
			})
		);
	});
	it.each(['downloadable', 'downloading'] as const)(
		'offers translation without creating a %s detector',
		async (status) => {
			const { api } = fixture(status);
			expect(await shouldOfferTranslation(api, 'Hello', 'ja')).toBe(true);
			expect(api.LanguageDetector.create).not.toHaveBeenCalled();
		}
	);
	it('only hides same-language posts when detection is confident and destroys the detector', async () => {
		const { api, detector } = fixture();
		expect(await shouldOfferTranslation(api, 'Hello', 'en')).toBe(false);
		expect(detector.destroy).toHaveBeenCalledOnce();
		expect(await shouldOfferTranslation(fixture('available', 'en', 0.3).api, 'Hi', 'en')).toBe(
			true
		);
	});

	it('returns a fallback for uncertain detection without preparing a translator', async () => {
		const { api, detector } = fixture('available', 'en', 0.2);
		expect(
			await translateInBrowser(api, 'Hello', 'en', {
				getDisplayName: () => undefined,
				prepare: (_, create) => create(),
				translating: () => {},
				signal: new AbortController().signal
			})
		).toBeUndefined();
		expect(api.Translator.create).not.toHaveBeenCalled();
		expect(detector.destroy).toHaveBeenCalledOnce();
	});
	it('does not translate confidently detected same-language results', async () => {
		const { api } = fixture();
		await expect(
			translateInBrowser(api, 'Hello', 'en', {
				getDisplayName: () => undefined,
				prepare: (_, create) => create(),
				translating: () => {},
				signal: new AbortController().signal
			})
		).rejects.toThrow('same');
		expect(api.Translator.create).not.toHaveBeenCalled();
	});
	it('does not create a translator for an unavailable pair', async () => {
		const { api, detector } = fixture();
		api.Translator.availability = vi.fn(async () => 'unavailable' as const);
		await expect(
			translateInBrowser(api, 'Hello', 'ja', {
				getDisplayName: () => undefined,
				prepare: (_, create) => create(),
				translating: () => {},
				signal: new AbortController().signal
			})
		).rejects.toThrow('unavailable');
		expect(api.Translator.create).not.toHaveBeenCalled();
		expect(detector.destroy).toHaveBeenCalledOnce();
	});
	it('does not use or destroy again a model aborted during preparation', async () => {
		const { api, detector } = fixture();
		const abort = new AbortController();
		await expect(
			translateInBrowser(api, 'Hello', 'ja', {
				getDisplayName: () => undefined,
				prepare: async (_, create) => {
					const instance = await create();
					abort.abort();
					return instance;
				},
				translating: () => {},
				signal: abort.signal
			})
		).rejects.toThrow();
		expect(detector.destroy).not.toHaveBeenCalled();
		expect(detector.detect).not.toHaveBeenCalled();
	});

	it('forwards cancellation to browser operations and discards a result completed after abort', async () => {
		const { api, translator, detector } = fixture();
		const controller = new AbortController();
		translator.translate.mockImplementation(async () => {
			controller.abort();
			return 'stale';
		});
		await expect(
			translateInBrowser(api, 'Hello\nLater', 'ja', {
				getDisplayName: () => undefined,
				prepare: (_, create) => create(),
				translating: () => {},
				signal: controller.signal
			})
		).rejects.toThrow();
		expect(api.LanguageDetector.create).toHaveBeenCalledWith(
			expect.objectContaining({ signal: controller.signal })
		);
		expect(detector.detect).toHaveBeenCalledWith('Hello\nLater', { signal: controller.signal });
		expect(api.Translator.create).toHaveBeenCalledWith(
			expect.objectContaining({ signal: controller.signal })
		);
		expect(translator.translate).toHaveBeenCalledWith('Hello', { signal: controller.signal });
		expect(translator.translate).toHaveBeenCalledOnce();
		expect(translator.destroy).not.toHaveBeenCalled();
	});

	it.each([
		{ text: 'First', expected: '[First]', lines: ['First'] },
		{ text: 'First\nSecond', expected: '[First]\n[Second]', lines: ['First', 'Second'] },
		{
			text: '\nFirst\n\n \t\nSecond\n',
			expected: '\n[First]\n\n \t\n[Second]\n',
			lines: ['First', 'Second']
		},
		{
			text: '\r\nFirst\r\n\nSecond\r\n',
			expected: '\r\n[First]\r\n\n[Second]\r\n',
			lines: ['First', 'Second']
		}
	])('preserves line separators and whitespace in $text', async ({ text, expected, lines }) => {
		const { api, detector, translator } = fixture();
		translator.translate.mockImplementation(async (line) => '[' + line + ']');
		const signal = new AbortController().signal;
		expect(
			await translateInBrowser(api, text, 'ja', {
				getDisplayName: () => undefined,
				prepare: (_, create) => create(),
				translating: () => {},
				signal
			})
		).toBe(expected);
		expect(detector.detect).toHaveBeenCalledExactlyOnceWith(text, { signal });
		expect(api.Translator.create).toHaveBeenCalledOnce();
		expect(translator.translate.mock.calls).toEqual(lines.map((line) => [line, { signal }]));
		expect(translator.destroy).toHaveBeenCalledOnce();
	});
	it('waits for each line and rejects the whole translation if a later line fails', async () => {
		const { api, translator } = fixture();
		const first = Promise.withResolvers<string>();
		translator.translate
			.mockImplementationOnce(() => first.promise)
			.mockRejectedValueOnce(new Error('translation failed'));
		const result = translateInBrowser(api, 'First\nSecond\nThird', 'ja', {
			getDisplayName: () => undefined,
			prepare: (_, create) => create(),
			translating: () => {},
			signal: new AbortController().signal
		});
		const rejected = expect(result).rejects.toThrow('translation failed');
		await vi.waitFor(() => expect(translator.translate).toHaveBeenCalledOnce());
		first.resolve('Translated first');
		await rejected;
		expect(translator.translate.mock.calls.map(([line]) => line)).toEqual(['First', 'Second']);
		expect(translator.destroy).toHaveBeenCalledOnce();
	});

	it('checks pair availability and destroys instances while returning plain text', async () => {
		const { api, detector, translator } = fixture();
		expect(
			await translateInBrowser(api, 'Hello', 'ja', {
				getDisplayName: () => undefined,
				prepare: (_, create) => create(),
				translating: () => {},
				signal: new AbortController().signal
			})
		).toBe('<script>translated</script>');
		expect(api.Translator.availability).toHaveBeenCalledWith({
			sourceLanguage: 'en',
			targetLanguage: 'ja'
		});
		expect(detector.destroy).toHaveBeenCalledOnce();
		expect(translator.destroy).toHaveBeenCalledOnce();
	});
});

describe('shared translation text', () => {
	it('uses the same reference conversions for both methods while detecting the original text', async () => {
		const pubkey = 'a'.repeat(64);
		const npub = npubEncode(pubkey);
		const profile = nprofileEncode({ pubkey });
		const missingNpub = npubEncode('c'.repeat(64));
		const missingProfile = nprofileEncode({ pubkey: 'c'.repeat(64) });
		const note = noteEncode('b'.repeat(64));
		const event = neventEncode({ id: 'b'.repeat(64) });
		const address = naddrEncode({ kind: 30023, pubkey, identifier: 'article' });
		const text = [
			'Hello & #日本語 nostr:' + npub + ' nostr:' + profile,
			'nostr:' + missingNpub + ' nostr:' + missingProfile,
			'',
			'nostr:' + note + ' nostr:' + event,
			'https://example.com/ nostr:' + address + ' Plain words',
			'  '
		].join('\r\n');
		const expectedLines = [
			'Hello & #日本語 @Name & 日本語 @Name & 日本語',
			'@' + missingNpub.substring(0, 12) + ' @' + missingProfile.substring(0, 16),
			'',
			'https://nostter.app/' + note + ' https://nostter.app/' + event,
			'https://example.com/ nostr:' + address + ' Plain words',
			'  '
		];
		const expected = expectedLines.join('\r\n');
		const getDisplayName = (key: string) => (key === pubkey ? 'Name & 日本語' : undefined);
		for (const messages of [en, ja]) {
			expect(
				googleTranslationUrl(text, messages.thread.translation.url, getDisplayName)
			).toBe(messages.thread.translation.url.replace('{0}', encodeURIComponent(expected)));
		}
		const { api, detector, translator } = fixture();
		translator.translate.mockImplementation(async (line) => line);
		const signal = new AbortController().signal;
		expect(
			await translateInBrowser(api, text, 'ja', {
				getDisplayName,
				prepare: (_, create) => create(),
				translating: () => {},
				signal
			})
		).toBe(expected);
		expect(detector.detect).toHaveBeenCalledExactlyOnceWith(text, { signal });
		expect(translator.translate.mock.calls).toEqual(
			expectedLines.filter((line) => line.trim()).map((line) => [line, { signal }])
		);
		expect(api.Translator.create).toHaveBeenCalledOnce();
	});
});
