import type * as Nostr from 'nostr-typedef';

export const profileBadgesKind = 10008;
export const legacyProfileBadgesKind = 30008;
export const legacyProfileBadgesIdentifier = 'profile_badges';

function isPreferredProfileBadgesEvent(candidate: Nostr.Event, current: Nostr.Event): boolean {
	if (candidate.created_at !== current.created_at) {
		return candidate.created_at > current.created_at;
	}
	if (candidate.kind !== current.kind) {
		return candidate.kind === profileBadgesKind;
	}
	return candidate.id < current.id;
}

export function selectProfileBadgesEvent(
	first: Nostr.Event | undefined,
	second: Nostr.Event | undefined
): Nostr.Event | undefined {
	if (first === undefined) {
		return second;
	}
	if (second === undefined) {
		return first;
	}
	return isPreferredProfileBadgesEvent(second, first) ? second : first;
}

function isLegacyProfileBadgesEvent(event: Nostr.Event): boolean {
	return (
		event.kind === legacyProfileBadgesKind &&
		event.tags.some(([name, value]) => name === 'd' && value === legacyProfileBadgesIdentifier)
	);
}

export function isProfileBadgesEvent(event: Nostr.Event): boolean {
	return event.kind === profileBadgesKind || isLegacyProfileBadgesEvent(event);
}

export function addAcceptedBadgeTags(
	sourceTags: string[][],
	definitionAddress: string,
	awardId: string,
	definitionRelay?: string,
	awardRelay?: string
): string[][] | undefined {
	if (sourceTags.some(([tagName, address]) => tagName === 'a' && address === definitionAddress)) {
		return undefined;
	}

	const tags = sourceTags.filter(([tagName]) => tagName !== 'd').map((tag) => tag.concat());
	const aTag = ['a', definitionAddress];
	if (definitionRelay !== undefined) {
		aTag.push(definitionRelay);
	}
	const eTag = ['e', awardId];
	if (awardRelay !== undefined) {
		eTag.push(awardRelay);
	}
	tags.push(aTag, eTag);
	return tags;
}
