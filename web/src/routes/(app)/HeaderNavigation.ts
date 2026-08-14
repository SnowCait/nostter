export const headerNavigationItems = [
	'home',
	'public',
	'search',
	'notifications',
	'lists',
	'bookmarks',
	'channels',
	'profile',
	'preferences',
	'about'
] as const;

export type HeaderNavigationItem = (typeof headerNavigationItems)[number];

const profileRoute = '/(app)/[slug=npub]';
const listsRoute = `${profileRoute}/(tabs)/lists`;
const bookmarksRoute = `${profileRoute}/bookmarks`;

function isRouteOrChild(routeId: string, route: string): boolean {
	return routeId === route || routeId.startsWith(`${route}/`);
}

export function getCurrentHeaderNavigation(
	routeId: string | null,
	pagePubkey: string | undefined,
	userPubkey: string | undefined
): HeaderNavigationItem | undefined {
	if (routeId === null) {
		return undefined;
	}

	if (isRouteOrChild(routeId, '/(app)/home')) return 'home';
	if (isRouteOrChild(routeId, '/(app)/public')) return 'public';
	if (isRouteOrChild(routeId, '/(app)/search')) return 'search';
	if (isRouteOrChild(routeId, '/(app)/notifications')) return 'notifications';
	if (isRouteOrChild(routeId, '/(app)/channels')) return 'channels';
	if (isRouteOrChild(routeId, '/(app)/preferences')) return 'preferences';
	if (isRouteOrChild(routeId, '/(app)/about')) return 'about';

	if (
		!isRouteOrChild(routeId, profileRoute) ||
		userPubkey === undefined ||
		pagePubkey !== userPubkey
	) {
		return undefined;
	}

	if (isRouteOrChild(routeId, listsRoute)) return 'lists';
	if (isRouteOrChild(routeId, bookmarksRoute)) return 'bookmarks';

	return 'profile';
}

const moreNavigationItems = new Set<HeaderNavigationItem>([
	'public',
	'lists',
	'bookmarks',
	'channels',
	'preferences',
	'about'
]);

export function isMoreNavigationCurrent(
	currentNavigation: HeaderNavigationItem | undefined
): boolean {
	return currentNavigation !== undefined && moreNavigationItems.has(currentNavigation);
}
