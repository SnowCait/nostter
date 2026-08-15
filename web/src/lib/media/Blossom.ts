import type { Event, EventTemplate } from 'nostr-tools';
import { now } from 'rx-nostr';
import { Signer } from '$lib/Signer';
import type { Media, MediaResult } from './Media';

export const defaultBlossomServer = new URL('https://blossom.band');

export function resolveBlossomServer(event: Event | undefined): URL {
	for (const [name, value] of event?.tags ?? []) {
		if (name !== 'server' || value === undefined) continue;
		try {
			const url = new URL(value);
			if (url.protocol === 'https:') return url;
		} catch {
			// Ignore malformed server tags.
		}
	}
	return new URL(defaultBlossomServer);
}

export function createBlossomAuthorizationTemplate(
	action: 'media' | 'upload',
	hash: string,
	server: URL,
	issuedAt: number = now()
): EventTemplate {
	return {
		kind: 24242,
		content: action === 'media' ? 'Upload media' : 'Upload blob',
		created_at: issuedAt,
		tags: [
			['t', action],
			['x', hash],
			['expiration', String(issuedAt + 5 * 60)],
			['server', server.hostname.toLowerCase()]
		]
	};
}

export function encodeBlossomAuthorization(event: Event): string {
	const bytes = new TextEncoder().encode(JSON.stringify(event));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function getBlossomUploadAction(fileType: string): 'media' | 'upload' {
	return fileType.startsWith('image/') || fileType.startsWith('video/') ? 'media' : 'upload';
}

async function sha256(file: File): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class Blossom implements Media {
	constructor(private readonly server: URL) {}

	async upload(file: File): Promise<MediaResult> {
		const action = getBlossomUploadAction(file.type);
		const hash = await sha256(file);
		const event = await Signer.signEvent(
			createBlossomAuthorizationTemplate(action, hash, this.server)
		);
		const response = await fetch(new URL(`/${action}`, this.server), {
			method: 'PUT',
			headers: {
				Authorization: `Nostr ${encodeBlossomAuthorization(event)}`,
				'Content-Type': file.type || 'application/octet-stream',
				'X-SHA-256': hash
			},
			body: file
		});
		if (!response.ok) throw new Error(await response.text());

		const data = await response.json();
		if (typeof data.url !== 'string') throw new Error('Invalid Blossom response');
		return { url: data.url, data };
	}
}
