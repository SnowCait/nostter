import { mount, unmount } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import ViewMore from './ViewMore.svelte';

export function fold(maxHeightRem = 20): Attachment<HTMLElement> {
	return (element) => {
		element.style.setProperty('--fold-max-height', `${maxHeightRem}rem`);
		const maxHeight = maxHeightRem * parseFloat(getComputedStyle(element).fontSize);
		let component: ReturnType<typeof mount> | undefined;
		let frame: number | undefined;

		const update = async (): Promise<void> => {
			frame = undefined;
			if (element.scrollHeight > maxHeight) {
				if (component === undefined) {
					component = mount(ViewMore, {
						target: element,
						props: {
							onfold: (folded: boolean) =>
								element.classList.toggle('folded-container', folded)
						}
					});
					element.classList.add('folded-container');
				}
			} else if (component !== undefined) {
				await unmount(component);
				component = undefined;
				element.classList.remove('folded-container');
			}
		};

		const observer = new ResizeObserver(() => {
			if (frame === undefined) {
				frame = requestAnimationFrame(update);
			}
		});
		observer.observe(element);

		return () => {
			observer.disconnect();
			if (frame !== undefined) {
				cancelAnimationFrame(frame);
			}
			if (component !== undefined) {
				unmount(component);
			}
		};
	};
}
