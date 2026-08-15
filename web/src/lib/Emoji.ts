export type Emoji = {
	content: string;
	url?: string;
};

export type PickerEmoji = {
	id: string;
	native?: string;
	shortcodes?: string;
	src?: string;
};

export function toEmoji(emoji: PickerEmoji): Emoji {
	if (emoji.native !== undefined) {
		return {
			content: emoji.native
		};
	} else {
		return {
			content: emoji.shortcodes ? emoji.shortcodes : `:${emoji.id.replaceAll('+', '_')}:`,
			url: emoji.src
		};
	}
}
