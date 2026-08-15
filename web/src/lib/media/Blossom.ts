import {
	Actions,
	createUploadAuth,
	type BlobDescriptor,
	type Signer as BlossomSigner
} from 'blossom-client-sdk';
import { Signer } from '$lib/Signer';
import type { Media, MediaResult } from './Media';

const signer: BlossomSigner = (template) => Signer.signEvent(template);

export class Blossom implements Media {
	constructor(private readonly server: URL) {}

	async upload(file: File): Promise<MediaResult> {
		const options = {
			onAuth: (server: URL, sha256: string, type: 'upload' | 'media') =>
				createUploadAuth(signer, sha256, {
					type,
					servers: server.href,
					expiration: Math.floor(Date.now() / 1000) + 5 * 60
				})
		};
		const descriptor = await (file.type.startsWith('image/') || file.type.startsWith('video/')
			? Actions.uploadMedia(this.server, file, options)
			: Actions.uploadBlob(this.server, file, options));
		return this.toMediaResult(descriptor);
	}

	private toMediaResult(descriptor: BlobDescriptor): MediaResult {
		return { url: descriptor.url, data: descriptor };
	}
}
