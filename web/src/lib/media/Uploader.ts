import { get } from 'svelte/store';
import { auth } from '$lib/auth.svelte';
import {
	getAccountLocalPreferences,
	type MediaUploaderPreference
} from '$lib/preferences/AccountLocalPreferences';
import { defaultBlossomServerUrl } from '$lib/Constants';
import type { Signer } from '$lib/nostr/signing/signer';
import { Blossom } from './Blossom';
import { FileStorageServer } from './FileStorageServer';
import type { Media } from './Media';

function createMediaUploader(
	preference: MediaUploaderPreference,
	signEvent: Signer['signEvent']
): Media {
	if (preference.type === 'nip96') return new FileStorageServer(preference.server, signEvent);
	return new Blossom(new URL(preference.server), signEvent);
}

export function getMediaUploader(): Media {
	if (auth.pubkey === undefined) {
		throw new Error('Cannot get media uploader without an authenticated session');
	}
	const signer = auth.signer;
	if (signer === undefined) {
		throw new Error('Cannot get media uploader without a signing session');
	}
	const preference = get(getAccountLocalPreferences(auth.pubkey)).mediaUploader ?? {
		type: 'blossom',
		server: defaultBlossomServerUrl
	};
	return createMediaUploader(preference, (template) => signer.signEvent(template));
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
