import type { Media, MediaResult } from './Media';

export class VoidCat implements Media {
	async upload(file: File): Promise<MediaResult> {
		const bufferSource = await file.arrayBuffer();
		const buffer = await crypto.subtle.digest('SHA-256', bufferSource);
		const digest = Array.from(new Uint8Array(buffer))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		const response = await fetch('https://void.cat/upload', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'V-Content-Type': file.type,
				'V-Full-Digest': digest,
				'V-Filename': file.name
			},
			body: bufferSource
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const data = await response.json();

		console.log('[void.cat]', data);

		if (!data.ok) {
			throw new Error(data.errorMessage);
		}

		return {
			url: '', // TODO
			data
		};
	}
}
