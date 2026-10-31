export interface Media {
	upload(file: Blob): Promise<MediaResult>;
}

export type MediaResult = {
	url: string;
	data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};
