import { get } from 'svelte/store';
import { auth } from '$lib/auth.svelte';
import { blossomServerListEvent } from '$lib/stores/Author';
import { getAccountLocalPreferences } from '$lib/preferences/AccountLocalPreferences';
import { Blossom, resolveBlossomServer } from './Blossom';
import { FileStorageServer } from './FileStorageServer';
import type { Media } from './Media';

export function getMediaUploader(): Media {
	const preference = get(getAccountLocalPreferences(auth.pubkey)).mediaUploader;
	if (preference?.type === 'nip96') return new FileStorageServer(preference.server);
	return new Blossom(resolveBlossomServer(get(blossomServerListEvent)));
}

export async function uploadFiles(
	files: FileList | File[]
): Promise<{ file: File; url: string | undefined }[]> {
	const media = getMediaUploader();
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
