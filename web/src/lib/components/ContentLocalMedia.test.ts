import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { locale } from 'svelte-i18n';
import { enablePreview } from '$lib/stores/Preference';
import Content from './Content.svelte';

beforeAll(() => locale.set('en'));
afterEach(() => enablePreview.set(true));

const media = { url: 'blob:local-image', kind: 'image' as const };

describe('local media preview preference', () => {
	it('renders local media in the post preview when previews are enabled', () => {
		enablePreview.set(true);
		const { body } = render(Content, { props: { content: '', tags: [], localMedia: [media] } });
		expect(body).toContain('blob:local-image');
	});

	it('does not expand local media in the post preview when previews are disabled', () => {
		enablePreview.set(false);
		const { body } = render(Content, { props: { content: '', tags: [], localMedia: [media] } });
		expect(body).not.toContain('blob:local-image');
	});
});
