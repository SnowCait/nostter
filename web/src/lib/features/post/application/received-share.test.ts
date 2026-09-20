import { describe, expect, it } from 'vitest';
import { receivedShare } from './received-share';

describe('receivedShare', () => {
	it('accepts multiple images and rejects non-images and invalid fields', () => {
		const form = new FormData();
		form.set('title', new File(['bad'], 'title.txt', { type: 'text/plain' }));
		form.set('text', 'A shared image');
		form.append('images', new File(['first'], 'first.png', { type: 'image/png' }));
		form.append('images', new File(['second'], 'second.svg', { type: '' }));
		form.append('images', new File(['video'], 'video.mp4', { type: 'video/mp4' }));
		form.append('images', 'not a file');

		const share = receivedShare(form);
		expect(share.title).toBeNull();
		expect(share.text).toBe('A shared image');
		expect(share.url).toBeNull();
		expect(share.files.map((file) => file.name)).toEqual(['first.png', 'second.svg']);
	});
});
