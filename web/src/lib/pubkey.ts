import { unique } from './Array';
import { hexRegexp } from './Constants';

export function isValidPubkey(value: string | undefined): value is string {
	return value !== undefined && hexRegexp.test(value);
}

export function pubkeysFromTags(tags: string[][]): string[] {
	return unique(
		tags.filter((tag) => tag[0] === 'p' && isValidPubkey(tag[1])).map((tag) => tag[1])
	);
}
