export type Emoji = {
	content: string;
	url?: string;
};

export function toEmoji(emoji: any): Emoji {
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
