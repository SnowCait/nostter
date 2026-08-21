import { beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { locale } from 'svelte-i18n';
import MediaPicker from './MediaPicker.svelte';

beforeAll(() => locale.set('en'));

describe('MediaPicker', () => {
	it('disables both the button and file input', () => {
		const { body } = render(MediaPicker, { props: { disabled: true } });
		expect(body).toMatch(/<button[^>]* disabled/);
		expect(body).toMatch(/<input[^>]* disabled/);
	});
});
