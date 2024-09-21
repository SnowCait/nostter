import { now } from 'rx-nostr';
import type { Kind } from 'nostr-tools';
import { Signer } from '$lib/Signer';
import { filterTags } from '$lib/EventHelper';
import { getMediaUploader, type Media, type MediaResult } from './Media';

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
		console.debug('[media upload auth]', event);

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

		// If the media provider uses delayed processing, we need to wait for the processing to be done
		const startTime = now();
		while (data.processing_url) {

			const processingEvent = await Signer.signEvent({
				kind: 27235 as Kind,
				content: '',
				created_at: now(),
				tags: [
					['u', data.processing_url],
					['method', 'GET']
				]
			});

			console.debug('[media upload processing auth]', event);

			const processing = await fetch(data.processing_url, {
				headers: {
					Authorization: `Nostr ${btoa(JSON.stringify(processingEvent))}`
				}
			});
	
			if (!processing.ok) {
				throw new Error(await processing.text());
			}

			const processingData = await processing.json();

			console.log('[media upload processing result]', processingData);
		
			if (processingData.status === "success") {
				break
			}

			if (now() - startTime > 60) {
				throw new Error('Failed to upload (timeout)'); // 60 seconds timeout
			}

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

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

export async function uploadFiles(
	files: FileList | File[]
): Promise<{ file: File; url: string | undefined }[]> {
	const media = new FileStorageServer(getMediaUploader());
	return await Promise.all(
		[...files].map(async (file) => {
			try {
				const { url } = await media.upload(file);
				return { file, url };
			} catch (error) {
				console.error('[media upload error]', error);
				return { file, url: undefined };
			}
		})
	);
}
