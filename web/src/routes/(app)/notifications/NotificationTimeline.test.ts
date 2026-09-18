import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import NotificationTimeline from './NotificationTimeline.svelte';

describe('NotificationTimeline', () => {
	it('does not mount the network-loading timeline while authentication is restoring', () => {
		const load = vi.fn(async () => undefined);

		const { body } = render(NotificationTimeline, {
			props: { authenticated: false, items: [], load }
		});

		expect(body).not.toContain('<span class="loader ');
		expect(load).not.toHaveBeenCalled();
	});

	it('mounts the network-loading timeline after authentication completes', () => {
		const load = vi.fn(async () => undefined);

		const { body } = render(NotificationTimeline, {
			props: { authenticated: true, items: [], load }
		});

		expect(body).toContain('<span class="loader ');
	});
});
