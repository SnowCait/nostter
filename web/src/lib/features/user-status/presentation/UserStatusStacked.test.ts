import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import type { Event } from 'nostr-tools';
import { UserStatuses } from 'nostr-tools/kinds';
import { userStatuses } from '../application/user-statuses.svelte';
import UserStatusStacked from './UserStatusStacked.svelte';

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

describe('UserStatusStacked', () => {
	it('links only the content of HTTP(S) statuses', () => {
		userStatuses.ingest(status('general', 'Working', [['r', 'https://nostter.app/']]));
		userStatuses.ingest(
			status('music', 'Intergalactic', [['r', 'spotify:search:Intergalactic']])
		);

		const { body } = render(UserStatusStacked, { props: { pubkey } });
		const anchors = body.match(/<a [\s\S]*?<\/a>/g) ?? [];

		expect(anchors).toHaveLength(1);
		const anchor = anchors[0] ?? '';
		expect(anchor).toContain('href="https://nostter.app/"');
		expect(anchor).toContain('Working');
		expect(anchor).toContain('tabler-icon-external-link');
		expect(anchor).not.toContain('tabler-icon-activity');
		expect(anchor.replace(/<[^>]*>/g, '')).not.toContain('nostter.app');
		expect(body).toContain('Intergalactic');
		expect(body).not.toContain('spotify:');
		expect(body.indexOf('Working')).toBeLessThan(body.indexOf('Intergalactic'));
	});
});
