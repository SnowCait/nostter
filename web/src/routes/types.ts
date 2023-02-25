export interface Timeline {
	events: Event[];
	users: Map<string, User>;
}

export interface Event {
	id: string;
	pubkey: string;
	created_at: number;
	kind: number;
	tags: string[][];
	content: string;
	sig: string;
}

export interface User {
	name: string;
	display_name: string;
	picture: string;
}
