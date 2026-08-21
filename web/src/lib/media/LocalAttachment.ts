import { mediaKindFromContentType, mediaKindFromPathname, type MediaKind } from './MediaType';
import { uploadFiles } from './Uploader';

export type UploadState = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface LocalAttachment {
	file: File;
	previewUrl: string;
	kind: MediaKind;
	state: UploadState;
	url?: string;
}

export interface LocalMediaPreview {
	url: string;
	kind: MediaKind;
}

export function createLocalAttachments(files: FileList | File[]): LocalAttachment[] {
	return [...files].flatMap((file) => {
		const kind = mediaKindFromContentType(file.type) ?? mediaKindFromPathname(file.name);
		return kind === undefined
			? []
			: [{ file, previewUrl: URL.createObjectURL(file), kind, state: 'pending' as const }];
	});
}

export function appendUrls(content: string, urls: string[]): string {
	if (urls.length === 0) return content;
	return content + (content === '' ? '' : '\n') + urls.join('\n');
}

export function revokeAttachments(attachments: LocalAttachment[]): void {
	for (const attachment of attachments) URL.revokeObjectURL(attachment.previewUrl);
}

export async function uploadLocalAttachments(
	attachments: LocalAttachment[],
	upload: typeof uploadFiles = uploadFiles
): Promise<boolean> {
	const candidates = attachments.filter(({ state }) => state === 'pending' || state === 'failed');
	if (candidates.length === 0) return attachments.every(({ state }) => state === 'uploaded');

	for (const attachment of candidates) attachment.state = 'uploading';
	let results: Awaited<ReturnType<typeof uploadFiles>>;
	try {
		results = await upload(candidates.map(({ file }) => file));
	} catch (error) {
		console.error('[media upload error]', error);
		for (const attachment of candidates) attachment.state = 'failed';
		return false;
	}
	for (const attachment of candidates) {
		const result = results.find(({ file }) => file === attachment.file);
		attachment.url = result?.url;
		attachment.state = result?.url === undefined ? 'failed' : 'uploaded';
	}
	return attachments.every(({ state }) => state === 'uploaded');
}
