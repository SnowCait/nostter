export type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable';
type Monitor = {
	addEventListener(type: 'downloadprogress', listener: (event: { loaded: number }) => void): void;
};
type Options = { monitor?: (monitor: Monitor) => void };
export type Detection = { detectedLanguage: string; confidence: number };
type Detector = { detect(text: string): Promise<Detection[]>; destroy(): void };
type Translator = { translate(text: string): Promise<string>; destroy(): void };
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
	target: string
): Promise<boolean> {
	const availability = await api.LanguageDetector.availability();
	if (availability === 'unavailable') {
		return false;
	}
	if (availability !== 'available') {
		return true;
	}
	const detector = await api.LanguageDetector.create();
	try {
		const source = confidentLanguage(await detector.detect(text));
		if (!source) {
			return true;
		}
		if (source.split('-')[0] === target) {
			return false;
		}
		return (
			(await api.Translator.availability({
				sourceLanguage: source,
				targetLanguage: target
			})) !== 'unavailable'
		);
	} finally {
		detector.destroy();
	}
}

export async function translateInBrowser(
	api: TranslationApis,
	text: string,
	target: string,
	hooks: {
		prepare(
			availability: Availability,
			create: () => Promise<Detector | Translator>
		): Promise<Detector | Translator>;
		progress(value: number): void;
		signal: AbortSignal;
	}
): Promise<string> {
	const monitor = (monitor: Monitor) =>
		monitor.addEventListener('downloadprogress', (event) => {
			if (!hooks.signal.aborted) {
				hooks.progress(event.loaded);
			}
		});
	const detectorAvailability = await api.LanguageDetector.availability();
	if (detectorAvailability === 'unavailable') {
		throw new Error('unavailable');
	}
	hooks.signal.throwIfAborted();
	const detector = (await hooks.prepare(detectorAvailability, () =>
		api.LanguageDetector.create({ monitor })
	)) as Detector;
	let source: string | undefined;
	try {
		hooks.signal.throwIfAborted();
		source = confidentLanguage(await detector.detect(text));
	} finally {
		detector.destroy();
	}
	hooks.signal.throwIfAborted();
	if (!source) {
		throw new Error('uncertain');
	}
	if (source.split('-')[0] === target) {
		throw new Error('same');
	}
	const pair = { sourceLanguage: source, targetLanguage: target };
	const availability = await api.Translator.availability(pair);
	hooks.signal.throwIfAborted();
	if (availability === 'unavailable') {
		throw new Error('unavailable');
	}
	const translator = (await hooks.prepare(availability, () =>
		api.Translator.create({ ...pair, monitor })
	)) as Translator;
	try {
		hooks.signal.throwIfAborted();
		return await translator.translate(text);
	} finally {
		translator.destroy();
	}
}
