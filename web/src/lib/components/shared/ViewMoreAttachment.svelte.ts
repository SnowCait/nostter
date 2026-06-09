import { mount, unmount } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import ViewMore from './ViewMore.svelte';

export function fold(maxHeightRem = 20): Attachment<HTMLElement> {
	return (element) => {
		element.style.setProperty('--fold-max-height', `${maxHeightRem}rem`);
		let component: ReturnType<typeof mount> | undefined;
		const observer = new ResizeObserver(async () => {
			const maxHeight = maxHeightRem * parseFloat(getComputedStyle(element).fontSize);
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
}
