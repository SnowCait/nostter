export interface Media {
	upload(file: File): Promise<MediaResult>;
}

export type MediaResult = {
	url: string;
	data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};
