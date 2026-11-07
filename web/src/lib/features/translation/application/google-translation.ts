import { prepareTranslationText } from '../domain/translation-text';

export function googleTranslationUrl(
	text: string,
	template: string,
	getDisplayName: (pubkey: string) => string | undefined
): string {
	return template.replace(
		'{0}',
		encodeURIComponent(prepareTranslationText(text, getDisplayName))
	);
}
