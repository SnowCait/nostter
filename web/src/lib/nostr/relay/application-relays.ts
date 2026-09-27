import { defaultRelays, localizedRelays } from '$lib/Constants';

export function applicationRelays(locale: string | null | undefined) {
	return locale?.startsWith('ja') ? [...defaultRelays, ...localizedRelays.ja] : defaultRelays;
}
