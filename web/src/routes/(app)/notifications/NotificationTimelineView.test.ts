import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import NotificationTimelineView from './NotificationTimelineView.svelte';

describe('NotificationTimelineView', () => {
	it('does not mount the network-loading timeline while authentication is restoring', () => {
		const load = vi.fn(async () => undefined);

		const { body } = render(NotificationTimelineView, {
			props: { authenticated: false, items: [], load }
		});

		expect(body.replaceAll(/<!--[\s\S]*?-->/g, '')).toBe('');
		expect(load).not.toHaveBeenCalled();
	});

	it('mounts the network-loading timeline after authentication completes', () => {
		const load = vi.fn(async () => undefined);

		const { body } = render(NotificationTimelineView, {
			props: { authenticated: true, items: [], load }
		});

		expect(body.replaceAll(/<!--[\s\S]*?-->/g, '')).not.toBe('');
	});
});
