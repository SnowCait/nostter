import { goto } from '$app/navigation';
import { auth } from '$lib/auth.svelte';

export function resolveLandingPath(): '/home' | '/public' {
	return auth.followingPubkeys.length > 0 ? '/home' : '/public';
}

export async function gotoAfterLogin(): Promise<void> {
	await goto(resolveLandingPath());
}
