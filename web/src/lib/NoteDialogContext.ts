import { createContext } from 'svelte';
import type * as Nostr from 'nostr-typedef';
import type { EventItem } from '$lib/Items';

export interface NoteDialogOpenRequest {
	content?: string;
	replyTo?: EventItem;
	quotes?: Nostr.Event[];
}

export type OpenNoteDialog = (request?: NoteDialogOpenRequest) => Promise<void>;

export const [getOpenNoteDialog, setOpenNoteDialog] = createContext<OpenNoteDialog>();
