import { get } from 'svelte/store';
import { fileStorageServers } from '$lib/Constants';
import { preferencesStore } from '$lib/Preferences';

export interface Media {
	upload(file: File): Promise<MediaResult>;
}

export type MediaResult = {
	url: string;
	data: any;
};

export function getMediaUploader(): string {
	const $preferencesStore = get(preferencesStore);
	return $preferencesStore.mediaUploader ?? fileStorageServers[0];
}
