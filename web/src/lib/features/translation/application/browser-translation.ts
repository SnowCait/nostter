export type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | null;
type Options = { signal?: AbortSignal };
export type Detection = { detectedLanguage: string; confidence: number };
type Detector = {
	detect(text: string, options?: { signal?: AbortSignal }): Promise<Detection[]>;
	destroy(): void;
};
type Translator = {
	translate(text: string, options?: { signal?: AbortSignal }): Promise<string>;
	destroy(): void;
};
export type TranslationApis = {
	LanguageDetector: {
		availability(): Promise<Availability>;
		create(options?: Options): Promise<Detector>;
	};
	Translator: {
		availability(options: Pair): Promise<Availability>;
		create(options: Pair & Options): Promise<Translator>;
	};
};
type Pair = { sourceLanguage: string; targetLanguage: string };

export function browserTranslationApis(): TranslationApis | undefined {
	if (typeof window === 'undefined') {
		return;
	}
	const api = window as unknown as Partial<TranslationApis>;
	if (
		typeof api.LanguageDetector?.availability !== 'function' ||
		typeof api.LanguageDetector.create !== 'function' ||
		typeof api.Translator?.availability !== 'function' ||
		typeof api.Translator.create !== 'function'
	) {
		return;
	}
	return api as TranslationApis;
}

// Only suppress the opportunity to translate when detection is confident.
export function confidentLanguage(results: Detection[]): string | undefined {
	const best = results[0];
	return best && best.confidence >= 0.8 && best.detectedLanguage !== 'und'
		? best.detectedLanguage
		: undefined;
}

export function displayLanguage(locale: string | null | undefined): string {
	// These are the registered UI dictionaries; other locales use the English fallback.
	return locale?.split('-')[0] === 'ja' ? 'ja' : 'en';
}

export async function shouldOfferTranslation(
	api: TranslationApis,
	text: string,
	target: string,
	signal?: AbortSignal
): Promise<boolean> {
	const availability = await api.LanguageDetector.availability();
	if (availability === null || availability === 'unavailable') {
		return false;
	}
	if (availability !== 'available') {
		return true;
	}
	signal?.throwIfAborted();
	const detector = await api.LanguageDetector.create({ signal });
	try {
		const source = confidentLanguage(await detector.detect(text, { signal }));
		if (!source) {
			return true;
		}
		if (source.split('-')[0] === target) {
			return false;
		}
		const pairAvailability = await api.Translator.availability({
			sourceLanguage: source,
			targetLanguage: target
		});
		return pairAvailability !== null && pairAvailability !== 'unavailable';
	} finally {
		if (!signal?.aborted) {
			detector.destroy();
		}
	}
}

export async function translateInBrowser(
	api: TranslationApis,
	text: string,
	target: string,
	hooks: {
		prepare(
			availability: Exclude<Availability, null | 'unavailable'>,
			create: () => Promise<Detector | Translator>
		): Promise<Detector | Translator>;
		translating(): void;
		signal: AbortSignal;
	}
): Promise<string | undefined> {
	const detectorAvailability = await api.LanguageDetector.availability();
	if (detectorAvailability === null || detectorAvailability === 'unavailable') {
		throw new Error('unavailable');
	}
	hooks.signal.throwIfAborted();
	const detector = (await hooks.prepare(detectorAvailability, () =>
		api.LanguageDetector.create({ signal: hooks.signal })
	)) as Detector;
	let source: string | undefined;
	try {
		hooks.signal.throwIfAborted();
		source = confidentLanguage(await detector.detect(text, { signal: hooks.signal }));
	} finally {
		if (!hooks.signal.aborted) {
			detector.destroy();
		}
	}
	hooks.signal.throwIfAborted();
	if (!source) {
		return;
	}
	if (source.split('-')[0] === target) {
		throw new Error('same');
	}
	const pair = { sourceLanguage: source, targetLanguage: target };
	const availability = await api.Translator.availability(pair);
	hooks.signal.throwIfAborted();
	if (availability === null || availability === 'unavailable') {
		throw new Error('unavailable');
	}
	const translator = (await hooks.prepare(availability, () =>
		api.Translator.create({ ...pair, signal: hooks.signal })
	)) as Translator;
	try {
		hooks.signal.throwIfAborted();
		hooks.translating();
		const parts = text.split(/(\r?\n)/);
		for (let index = 0; index < parts.length; index++) {
			hooks.signal.throwIfAborted();
			if (parts[index].trim()) {
				parts[index] = await translator.translate(parts[index], { signal: hooks.signal });
				hooks.signal.throwIfAborted();
			}
		}
		return parts.join('');
	} finally {
		if (!hooks.signal.aborted) {
			translator.destroy();
		}
	}
}
