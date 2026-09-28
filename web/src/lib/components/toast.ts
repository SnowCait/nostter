import { createToaster } from '@melt-ui/svelte';

export type ToastData = {
	title: string;
	description: string;
};

// The single toast collection shared by the API below and the root Toaster renderer.
// Features should use `toast` instead of this Melt UI builder directly.
export const toaster = createToaster<ToastData>();

export const toast = {
	add(data: ToastData): void {
		toaster.helpers.addToast({ data });
	}
};
