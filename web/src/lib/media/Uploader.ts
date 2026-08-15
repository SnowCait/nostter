import { get } from 'svelte/store';
import { auth } from '$lib/auth.svelte';
import {
	getAccountLocalPreferences,
	type MediaUploaderPreference
} from '$lib/preferences/AccountLocalPreferences';
import { defaultBlossomServerUrl } from '$lib/Constants';
import { Blossom } from './Blossom';
import { FileStorageServer } from './FileStorageServer';
import type { Media } from './Media';

function createMediaUploader(preference: MediaUploaderPreference): Media {
	if (preference.type === 'nip96') return new FileStorageServer(preference.server);
	return new Blossom(new URL(preference.server));
}

export function getMediaUploader(): Media {
	const preference = get(getAccountLocalPreferences(auth.pubkey)).mediaUploader ?? {
		type: 'blossom',
		server: defaultBlossomServerUrl
	};
	return createMediaUploader(preference);
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
