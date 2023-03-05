export interface Timeline {
	events: Event[];
}

export interface Event {
	id: string;
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
	sig: string;
	user: User;
}

export interface UserEvent extends Event {
	user: User;
}

export interface User {
	name: string;
	display_name: string;
	nip05: string;
	picture: string;
	website: string;
}

export interface RelayPermission {
	read: boolean;
	write: boolean;
}
