let focus = $state<(() => void) | undefined>();

export const composerFocus = {
	get current() {
		return focus;
	},
	set current(value: (() => void) | undefined) {
		focus = value;
	}
};
