import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { addMessages, locale } from 'svelte-i18n';
import { ShortTextNote } from 'nostr-tools/kinds';
import type * as Nostr from 'nostr-typedef';
import { pinnedNotes } from '$lib/features/pinned-notes/application/pinned-notes-runtime.svelte';
import en from '$lib/i18n/locales/en.json';
import MenuButton from './MenuButton.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('https://nostter.app/') }
}));

beforeAll(() => {
	addMessages('en', en);
	locale.set('en');
});
afterEach(() => pinnedNotes.reset());

const me = 'a'.repeat(64);
const other = 'b'.repeat(64);
const note: Nostr.Event = {
	id: 'c'.repeat(64),
	pubkey: other,
	kind: ShortTextNote,
	tags: [],
	content: '',
	created_at: 1,
	sig: 'd'.repeat(128)
};

function renderMenu(event: Nostr.Event, canSign: boolean): string {
	return render(MenuButton, {
		props: {
			event,
			iconSize: 20,
			canSign,
			getCapabilities: () => {
				throw new Error('unused');
			}
		}
	}).body;
}

describe('MenuButton pin actions', () => {
	it('offers Pin for another author’s kind 1 note', () => {
		pinnedNotes.initialize(me);
		const body = renderMenu(note, true);
		expect(body).toContain('Pin to your profile');
		expect(body).not.toContain('Unpin from your profile');
	});

	it('offers Unpin when the note is in the effective pin list', () => {
		pinnedNotes.initialize(me, {
			id: 'e'.repeat(64),
			pubkey: me,
			kind: 10001,
			tags: [['e', note.id]],
			content: '',
			created_at: 1,
			sig: 'f'.repeat(128)
		});
		const body = renderMenu(note, true);
		expect(body).toContain('Unpin from your profile');
		expect(body).not.toContain('Pin to your profile');
	});

	it('hides pin actions when the account cannot sign', () => {
		pinnedNotes.initialize(me);
		expect(renderMenu(note, false)).not.toContain('your profile');
	});

	it('hides pin actions for non-kind 1 events', () => {
		pinnedNotes.initialize(me);
		expect(renderMenu({ ...note, kind: 42 }, true)).not.toContain('your profile');
	});
});
