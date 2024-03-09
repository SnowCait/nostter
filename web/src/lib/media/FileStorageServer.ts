import { now } from 'rx-nostr';
import type { Kind } from 'nostr-tools';
import { Signer } from '$lib/Signer';
import { filterTags } from '$lib/EventHelper';
import type { Media, MediaResult } from './Media';

export async function fetchNip96(origin: string): Promise<any> {
	const nip96Url = new URL(origin);
	nip96Url.pathname = '/.well-known/nostr/nip96.json';
	const nip96Response = await fetch(nip96Url);
	if (!nip96Response.ok) {
		throw new Error('Failed to fetch NIP-96');
	}
	return await nip96Response.json();
}

export class FileStorageServer implements Media {
	constructor(private readonly origin: string) {}

	async upload(file: File): Promise<MediaResult> {
		const nip96Json = await fetchNip96(this.origin);
		console.debug('[media upload server]', nip96Json);
		if (nip96Json.api_url === undefined) {
			throw new Error('Invalid NIP-96');
		}

		const method = 'POST';
		const apiUrl = nip96Json.api_url;

		const form = new FormData();
		form.append('file', file);

		const event = await Signer.signEvent({
			kind: 27235 as Kind,
			content: '',
			created_at: now(),
			tags: [
				['u', apiUrl],
				['method', method]
			]
		});
		console.debug('[media uplaod auth]', event);

		const response = await fetch(apiUrl, {
			method,
			headers: {
				Authorization: `Nostr ${btoa(JSON.stringify(event))}`
			},
			body: form
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const data = await response.json();

		console.log('[media upload result]', data);

		const url = filterTags('url', data.nip94_event.tags).at(0);
		if (url === undefined) {
			throw new Error('Failed to upload');
		}
		return {
			url,
			data
		};
	}
}
