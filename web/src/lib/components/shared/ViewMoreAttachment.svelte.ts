import { mount, unmount } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import ViewMore from './ViewMore.svelte';

export const fold: Attachment = (element) => {
	let component: ReturnType<typeof mount> | undefined;
	const observer = new ResizeObserver(async () => {
		const maxHeight = 20 * parseFloat(getComputedStyle(element).fontSize);
		if (element.scrollHeight > maxHeight) {
			if (component === undefined) {
				component = mount(ViewMore, { target: element });
			}
		} else if (component !== undefined) {
			await unmount(component);
			component = undefined;
		}
	});
	observer.observe(element);

	return () => {
		observer.disconnect();
		if (component !== undefined) {
			unmount(component);
		}
	};
};
