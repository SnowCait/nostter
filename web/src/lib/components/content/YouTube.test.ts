import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { writable } from 'svelte/store';
import { enablePreview } from '$lib/stores/Preference';
import YouTube from './YouTube.svelte';

vi.mock('$app/stores', () => ({ page: writable({ url: new URL('https://nostter.example') }) }));

afterEach(() => enablePreview.set(true));

function playerSrc(link: string): URL {
	enablePreview.set(true);
	const { body } = render(YouTube, { props: { link: new URL(link) } });
	const src = body.match(/<iframe[^>]*src="(?<src>[^"]+)"/)?.groups?.src;

	expect(src).toBeDefined();
	return new URL(src!.replaceAll('&amp;', '&'));
}

describe('YouTube URL', () => {
	it.each([
		'https://www.youtube.com/embed/M7lc1UVf-VE',
		'https://www.youtube.com/shorts/M7lc1UVf-VE',
		'https://www.youtube.com/watch?v=M7lc1UVf-VE',
		'https://youtu.be/M7lc1UVf-VE',
		'https://www.youtube.com/live/M7lc1UVf-VE',
		'https://www.youtube.com/live/M7lc1UVf-VE/extra'
	])('embeds the video from %s', (link) => {
		expect(playerSrc(link).pathname).toBe('/embed/M7lc1UVf-VE');
	});

	it('preserves the converted start time for an embedded video URL', () => {
		expect(
			playerSrc('https://www.youtube.com/embed/M7lc1UVf-VE?t=90').searchParams.get('start')
		).toBe('90');
	});
});
