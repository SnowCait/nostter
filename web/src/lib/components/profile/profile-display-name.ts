import { alternativeName, type Metadata } from '$lib/Items';
import { getPrivateNickname } from '$lib/features/private-nicknames/application/private-nicknames.svelte';

export function resolveProfileDisplayName(
	pubkey: string,
	metadata: Metadata | undefined
): { text: string; tags?: string[][] } {
	const nickname = getPrivateNickname(pubkey);
	if (nickname !== undefined) {
		return { text: nickname };
	}
	if (metadata !== undefined) {
		return { text: metadata.displayName, tags: metadata.event.tags };
	}
	return { text: alternativeName(pubkey) };
}
