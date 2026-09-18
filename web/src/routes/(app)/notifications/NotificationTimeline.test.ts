import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import NotificationTimeline from './NotificationTimeline.svelte';

describe('NotificationTimeline', () => {
	it('does not render the timeline while authentication is restoring', () => {
		const load = vi.fn(async () => undefined);

		const { body } = render(NotificationTimeline, {
			props: { authenticated: false, items: [], load }
		});

		expect(body).not.toContain('<span class="loader ');
		expect(load).not.toHaveBeenCalled();
	});

	it('renders the timeline after authentication completes', () => {
		const load = vi.fn(async () => undefined);

		const { body } = render(NotificationTimeline, {
			props: { authenticated: true, items: [], load }
		});

		expect(body).toContain('<span class="loader ');
	});
});
