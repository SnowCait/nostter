import { describe, expect, it, vi } from 'vitest';
import {
	displayLanguage,
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
				prepare,
				chooseSource: async () => 'en',
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
				prepare: (_, create) => create(),
				chooseSource: async () => 'en',
				translating,
				signal: new AbortController().signal
			})
		).rejects.toThrow('unavailable');
		expect(api.Translator.create).not.toHaveBeenCalled();
		expect(translating).not.toHaveBeenCalled();
	});

	it('uses the actual UI fallback for unsupported system languages', () => {
		expect(displayLanguage('fr-FR')).toBe('en');
		expect(displayLanguage('ja-JP')).toBe('ja');
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

	it('asks for a source only for uncertain detection and uses the user choice', async () => {
		const { api } = fixture('available', 'en', 0.2);
		const chooseSource = vi.fn(async () => 'fr');
		await translateInBrowser(api, 'Hello', 'en', {
			chooseSource,
			prepare: (_, create) => create(),
			translating: () => {},
			signal: new AbortController().signal
		});
		expect(chooseSource).toHaveBeenCalledOnce();
		expect(api.Translator.availability).toHaveBeenCalledWith({
			sourceLanguage: 'fr',
			targetLanguage: 'en'
		});
	});
	it('does not translate confidently detected same-language results', async () => {
		const { api } = fixture();
		const chooseSource = vi.fn(async () => 'fr');
		await expect(
			translateInBrowser(api, 'Hello', 'en', {
				chooseSource,
				prepare: (_, create) => create(),
				translating: () => {},
				signal: new AbortController().signal
			})
		).rejects.toThrow('same');
		expect(chooseSource).not.toHaveBeenCalled();
		expect(api.Translator.create).not.toHaveBeenCalled();
	});
	it('does not create a translator for an unavailable pair', async () => {
		const { api, detector } = fixture();
		api.Translator.availability = vi.fn(async () => 'unavailable' as const);
		await expect(
			translateInBrowser(api, 'Hello', 'ja', {
				chooseSource: async () => 'fr',
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
				chooseSource: async () => 'fr',
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
				chooseSource: async () => 'fr',
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
				chooseSource: async () => 'fr',
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
			chooseSource: async () => 'fr',
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
				chooseSource: async () => 'fr',
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
