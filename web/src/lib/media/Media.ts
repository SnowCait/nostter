export interface Media {
	upload(file: File): Promise<MediaResult>;
}

export type MediaResult = {
	url: string;
};
