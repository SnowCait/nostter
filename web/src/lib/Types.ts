export type id = string;
export type pubkey = string;

export type Timeout = string | number | NodeJS.Timeout;

export interface ChannelMetadata {
	name: string | undefined;
	about: string | undefined;
	picture: string | undefined;
}
