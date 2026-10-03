import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Event } from 'nostr-tools';
import { UserStatuses } from 'nostr-tools/kinds';
import { userStatuses } from '../application/user-statuses.svelte';
import UserStatusInline from './UserStatusInline.svelte';

vi.mock('$lib/nostr/relay/event-operations', () => ({ requestEvents: vi.fn() }));

const pubkey = 'a'.repeat(64);

function status(type: string, content: string, tags: string[][] = []): Event {
	return {
		id: type,
		pubkey,
		kind: UserStatuses,
		created_at: Math.floor(Date.now() / 1000),
		tags: [['d', type], ...tags],
		content,
		sig: 'sig'
	};
}

describe('UserStatusInline', () => {
	it('renders general then music in a single container without links', () => {
		userStatuses.ingest(status('general', 'Working', [['r', 'https://nostter.app/']]));
		userStatuses.ingest(status('music', 'Intergalactic', [['r', 'https://music.example/']]));

		const { body } = render(UserStatusInline, { props: { pubkey } });

		expect(body.match(/class="user-status-inline/g)).toHaveLength(1);
		expect(body.indexOf('Working')).toBeLessThan(body.indexOf('Intergalactic'));
		expect(body).not.toContain('<a');
		expect(body).not.toContain('tabler-icon-external-link');
	});
});
