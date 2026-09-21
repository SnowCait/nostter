import { uploadMedia } from 'blossom-client-sdk/actions/media';
import { uploadBlob } from 'blossom-client-sdk/actions/upload';
import { createUploadAuth } from 'blossom-client-sdk/auth';
import type { Media, MediaResult } from './Media';

type BlobDescriptor = Awaited<ReturnType<typeof uploadBlob>>;
type BlossomSigner = Parameters<typeof createUploadAuth>[0];

export class Blossom implements Media {
	constructor(
		private readonly server: URL,
		private readonly signEvent: BlossomSigner
	) {}

	async upload(file: File): Promise<MediaResult> {
		const options = {
			onAuth: (server: URL, sha256: string, type: 'upload' | 'media') =>
				createUploadAuth(this.signEvent, sha256, {
					type,
					servers: server.href,
					expiration: Math.floor(Date.now() / 1000) + 5 * 60
				})
		};
		const descriptor = await (file.type.startsWith('image/') || file.type.startsWith('video/')
			? uploadMedia(this.server, file, options)
			: uploadBlob(this.server, file, options));
		return this.toMediaResult(descriptor);
	}

	private toMediaResult(descriptor: BlobDescriptor): MediaResult {
		return { url: descriptor.url, data: descriptor };
	}
}
