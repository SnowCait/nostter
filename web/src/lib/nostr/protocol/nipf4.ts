import type * as Nostr from 'nostr-typedef';

export const podcastEpisodeKind = 54;
export const podcastMetadataKind = 10154;

export interface PodcastAudio {
	url: string;
	mediaType?: string;
}

export interface PodcastEpisode {
	title?: string;
	image?: string;
	description?: string;
	audio: PodcastAudio[];
	content: string;
}

export interface PodcastMetadata {
	title?: string;
	image?: string;
	description?: string;
	websites: string[];
}

function findTagValue(tags: string[][], name: string): string | undefined {
	return tags.find((tag) => tag[0] === name && tag[1])?.[1];
}

function findUrlTagValue(tags: string[][], name: string): string | undefined {
	return tags.find((tag) => tag[0] === name && tag[1] !== undefined && URL.canParse(tag[1]))?.[1];
}

export function parsePodcastEpisode(event: Nostr.Event): PodcastEpisode {
	return {
		title: findTagValue(event.tags, 'title'),
		image: findUrlTagValue(event.tags, 'image'),
		description: findTagValue(event.tags, 'description'),
		audio: event.tags
			.filter((tag) => tag[0] === 'audio' && tag[1] !== undefined && URL.canParse(tag[1]))
			.map(([, url, mediaType]) => ({
				url,
				mediaType: mediaType || undefined
			})),
		content: event.content
	};
}

export function parsePodcastMetadata(event: Nostr.Event): PodcastMetadata {
	return {
		title: findTagValue(event.tags, 'title'),
		image: findUrlTagValue(event.tags, 'image'),
		description: findTagValue(event.tags, 'description'),
		websites: event.tags
			.filter((tag) => tag[0] === 'website' && tag[1] !== undefined && URL.canParse(tag[1]))
			.map(([, website]) => website)
	};
}
