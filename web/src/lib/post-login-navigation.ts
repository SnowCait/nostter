import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { originalFollowees } from '$lib/stores/Author';

export function resolveLandingPath(): '/home' | '/public' {
	return get(originalFollowees).length > 0 ? '/home' : '/public';
}

export async function gotoAfterLogin(): Promise<void> {
	await goto(resolveLandingPath());
}
