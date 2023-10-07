import type { Media, MediaResult } from './Media';

export class VoidCat implements Media {
	async upload(file: File): Promise<MediaResult> {
		const data = await file.arrayBuffer();
		const buffer = await crypto.subtle.digest('SHA-256', data);
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
			body: data
		});

		if (!response.ok) {
			throw new Error(await response.text());
		}

		const result = await response.json();

		console.log('[void.cat]', result);

		if (!result.ok) {
			throw new Error(result.errorMessage);
		}

		return {
			url: '' // TODO
		};
	}
}
