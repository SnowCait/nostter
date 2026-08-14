import { describe, expect, it } from 'vitest';
import { getCurrentHeaderNavigation, isMoreNavigationCurrent } from './HeaderNavigation';

const userPubkey = 'user';
const otherPubkey = 'other';

describe('getCurrentHeaderNavigation', () => {
	it.each([
		['/(app)/home', 'home'],
		['/(app)/public', 'public'],
		['/(app)/search', 'search'],
		['/(app)/notifications', 'notifications'],
		['/(app)/channels/[nevent=note]', 'channels'],
		['/(app)/preferences/display', 'preferences'],
		['/(app)/about/licenses', 'about']
	] as const)('%s is %s', (routeId, expected) => {
		expect(getCurrentHeaderNavigation(routeId, undefined, userPubkey)).toBe(expected);
	});

	it('selects Public when the Home link also points to /public', () => {
		const homeLink = '/public';
		const current = getCurrentHeaderNavigation('/(app)/public', undefined, userPubkey);
		const currentLinks = [
			{ item: 'home', href: homeLink },
			{ item: 'public', href: '/public' }
		].filter(({ item }) => item === current);

		expect(currentLinks).toEqual([{ item: 'public', href: '/public' }]);
	});

	it.each([
		['/(app)/[slug=npub]/(tabs)/lists', 'lists'],
		['/(app)/[slug=npub]/(tabs)/lists/[naddr=naddr]', 'lists'],
		['/(app)/[slug=npub]/(tabs)/lists/[naddr=naddr]/members', 'lists'],
		['/(app)/[slug=npub]/bookmarks', 'bookmarks'],
		['/(app)/[slug=npub]/bookmarks/archive', 'bookmarks'],
		['/(app)/[slug=npub]/(tabs)', 'profile'],
		['/(app)/[slug=npub]/(tabs)/media', 'profile'],
		['/(app)/[slug=npub]/followers', 'profile']
	] as const)('classifies the current user route %s as %s', (routeId, expected) => {
		expect(getCurrentHeaderNavigation(routeId, userPubkey, userPubkey)).toBe(expected);
	});

	it.each([
		'/(app)/[slug=npub]/(tabs)',
		'/(app)/[slug=npub]/(tabs)/lists',
		'/(app)/[slug=npub]/bookmarks'
	])('does not select the current-user navigation for another user at %s', (routeId) => {
		expect(getCurrentHeaderNavigation(routeId, otherPubkey, userPubkey)).toBeUndefined();
	});

	it('does not select Profile for Lists or Bookmarks', () => {
		expect(
			['/(app)/[slug=npub]/(tabs)/lists', '/(app)/[slug=npub]/bookmarks'].map((routeId) =>
				getCurrentHeaderNavigation(routeId, userPubkey, userPubkey)
			)
		).toEqual(['lists', 'bookmarks']);
	});
});

describe('isMoreNavigationCurrent', () => {
	it.each(['public', 'lists', 'bookmarks', 'channels', 'preferences', 'about'] as const)(
		'returns true for %s',
		(navigation) => {
			expect(isMoreNavigationCurrent(navigation)).toBe(true);
		}
	);

	it.each(['home', 'search', 'notifications', 'profile', undefined] as const)(
		'returns false for %s',
		(navigation) => {
			expect(isMoreNavigationCurrent(navigation)).toBe(false);
		}
	);
});
