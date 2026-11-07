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
		translate: vi.fn(async () => '<script>translated</script>'),
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
	it('does not translate uncertain or same-language results', async () => {
		for (const [language, confidence, message] of [
			['en', 0.99, 'same'],
			['fr', 0.2, 'uncertain']
		] as const) {
			const { api } = fixture('available', language, confidence);
			await expect(
				translateInBrowser(api, 'Hello', 'en', {
					prepare: (_, create) => create(),
					progress: () => {},
					signal: new AbortController().signal
				})
			).rejects.toThrow(message);
			expect(api.Translator.create).not.toHaveBeenCalled();
		}
	});
	it('does not create a translator for an unavailable pair', async () => {
		const { api, detector } = fixture();
		api.Translator.availability = vi.fn(async () => 'unavailable' as const);
		await expect(
			translateInBrowser(api, 'Hello', 'ja', {
				prepare: (_, create) => create(),
				progress: () => {},
				signal: new AbortController().signal
			})
		).rejects.toThrow('unavailable');
		expect(api.Translator.create).not.toHaveBeenCalled();
		expect(detector.destroy).toHaveBeenCalledOnce();
	});
	it('destroys a model that finishes preparing after navigation', async () => {
		const { api, detector } = fixture();
		const abort = new AbortController();
		await expect(
			translateInBrowser(api, 'Hello', 'ja', {
				prepare: async (_, create) => {
					const instance = await create();
					abort.abort();
					return instance;
				},
				progress: () => {},
				signal: abort.signal
			})
		).rejects.toThrow();
		expect(detector.destroy).toHaveBeenCalledOnce();
		expect(detector.detect).not.toHaveBeenCalled();
	});

	it('checks pair availability and destroys instances while returning plain text', async () => {
		const { api, detector, translator } = fixture();
		expect(
			await translateInBrowser(api, 'Hello', 'ja', {
				prepare: (_, create) => create(),
				progress: () => {},
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
