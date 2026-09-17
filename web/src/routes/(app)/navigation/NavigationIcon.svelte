<script lang="ts">
	import {
		IconBell,
		IconBellFilled,
		IconBookmark,
		IconBookmarkFilled,
		IconHome,
		IconHomeFilled,
		IconList,
		IconListFilled,
		IconMessages,
		IconMessagesFilled,
		IconPaw,
		IconPawFilled,
		IconSearch,
		IconSearchFilled,
		IconSettings,
		IconSettingsFilled,
		IconUser,
		IconUserFilled,
		IconWorld,
		IconWorldFilled
	} from '@tabler/icons-svelte-runes';
	import type { Icon } from '@tabler/icons-svelte-runes';
	import type { AppNavigationItem } from './app-navigation';

	const navigationIcons = {
		home: { inactive: IconHome, active: IconHomeFilled },
		public: { inactive: IconWorld, active: IconWorldFilled },
		search: { inactive: IconSearch, active: IconSearchFilled },
		notifications: { inactive: IconBell, active: IconBellFilled },
		lists: { inactive: IconList, active: IconListFilled },
		bookmarks: { inactive: IconBookmark, active: IconBookmarkFilled },
		channels: { inactive: IconMessages, active: IconMessagesFilled },
		profile: { inactive: IconUser, active: IconUserFilled },
		preferences: { inactive: IconSettings, active: IconSettingsFilled },
		about: { inactive: IconPaw, active: IconPawFilled }
	} satisfies Record<AppNavigationItem, { inactive: Icon; active: Icon }>;

	interface Props {
		item: AppNavigationItem;
		currentNavigation: AppNavigationItem | undefined;
		size?: number | string;
	}

	let { item, currentNavigation, size }: Props = $props();

	let CurrentIcon = $derived(
		navigationIcons[item][currentNavigation === item ? 'active' : 'inactive']
	);
</script>

<CurrentIcon {size} />
