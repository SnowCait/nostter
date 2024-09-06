import {
	CLOUDFLARE_ACCOUNT_ID,
	CLOUDFLARE_API_TOKEN,
	CLOUDFLARE_KV_NAMESPACE_ID
} from '$env/static/private';
import { error } from '@sveltejs/kit';

export async function checkRestriction(pubkey: string): Promise<void> {
	console.time('[npub restriction]');
	const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${pubkey}`;
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`
		}
	});
	console.timeEnd('[npub restriction]');
	if (response.ok) {
		const restriction = (await response.json()) as Restriction;
		console.error('[npub restriction]', restriction);
		error(restriction.status, restriction.statusText);
	}
}

interface Restriction {
	status: number;
	statusText: string;
	reason: string;
}
