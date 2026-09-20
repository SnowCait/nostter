import { mediaKindFromContentType, mediaKindFromPathname } from '$lib/media/MediaType';
import type { SharedPost } from '$lib/platform/storage/shared-post';

function stringField(form: FormData, name: string): string | null {
	const value = form.get(name);
	if (value === null || typeof value === 'string') return value;
	console.warn('[share target] Ignoring non-text field', name);
	return null;
}

export function receivedShare(form: FormData): Omit<SharedPost, 'id' | 'createdAt'> {
	const files: File[] = [];
	for (const value of form.getAll('images')) {
		if (!(value instanceof File)) {
			console.warn('[share target] Ignoring non-file image value');
			continue;
		}
		const kind = mediaKindFromContentType(value.type) ?? mediaKindFromPathname(value.name);
		if (kind !== 'image') {
			console.warn('[share target] Ignoring unsupported file', value.name);
			continue;
		}
		files.push(value);
	}
	return {
		title: stringField(form, 'title'),
		text: stringField(form, 'text'),
		url: stringField(form, 'url'),
		files
	};
}
