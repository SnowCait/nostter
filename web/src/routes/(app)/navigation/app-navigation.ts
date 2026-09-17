export const appNavigationItems = [
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

export type AppNavigationItem = (typeof appNavigationItems)[number];

export interface AppNavigationHrefOptions {
	homeLink: string;
	nprofile: string;
}

function assertUnreachableNavigationItem(item: never): never {
	throw new Error(`Unhandled app navigation item: ${item}`);
}

export function getAppNavigationHref(
	item: AppNavigationItem,
	{ homeLink, nprofile }: AppNavigationHrefOptions
): string {
	switch (item) {
		case 'home':
			return homeLink;
		case 'public':
			return '/public';
		case 'search':
			return '/search';
		case 'notifications':
			return '/notifications';
		case 'lists':
			return `/${nprofile}/lists`;
		case 'bookmarks':
			return `/${nprofile}/bookmarks`;
		case 'channels':
			return '/channels';
		case 'profile':
			return `/${nprofile}`;
		case 'preferences':
			return '/preferences';
		case 'about':
			return '/about';
		default:
			return assertUnreachableNavigationItem(item);
	}
}

const profileRoute = '/(app)/[slug=npub]';
const listsRoute = `${profileRoute}/(tabs)/lists`;
const bookmarksRoute = `${profileRoute}/bookmarks`;

function isRouteOrChild(routeId: string, route: string): boolean {
	return routeId === route || routeId.startsWith(`${route}/`);
}

export function getCurrentAppNavigation(
	routeId: string | null,
	pagePubkey: string | undefined,
	userPubkey: string | undefined
): AppNavigationItem | undefined {
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

const moreNavigationItems = new Set<AppNavigationItem>([
	'public',
	'lists',
	'bookmarks',
	'channels',
	'preferences',
	'about'
]);

export function isMoreNavigationCurrent(currentNavigation: AppNavigationItem | undefined): boolean {
	return currentNavigation !== undefined && moreNavigationItems.has(currentNavigation);
}
