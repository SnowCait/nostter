import { decode } from 'nostr-tools/nip19';

export function googleTranslationUrl(
	text: string,
	template: string,
	getDisplayName: (pubkey: string) => string | undefined
): string {
	const converted = text
		.replaceAll(
			/\bnostr:((npub|nprofile)1[023456789acdefghjklmnpqrstuvwxyz]{6,})\b/g,
			(_, bech32: string, prefix: string) => {
				try {
					const result = decode(bech32);
					if (result.type !== 'npub' && result.type !== 'nprofile') {
						throw new Error('logic error');
					}
					const pubkey = result.type === 'npub' ? result.data : result.data.pubkey;
					const metadata = getDisplayName(pubkey);
					if (metadata === undefined) {
						throw new Error('not found');
					}
					return `@${metadata}`;
				} catch {
					return `@${bech32.substring(0, prefix.length + '1'.length + 7)}`;
				}
			}
		)
		.replaceAll(
			/\bnostr:(?<bech32>(nevent|note)1[023456789acdefghjklmnpqrstuvwxyz]{6,})\b/g,
			'https://nostter.app/$<bech32>'
		);
	return template.replace('{0}', encodeURIComponent(converted));
}
