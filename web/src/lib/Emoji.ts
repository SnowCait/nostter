export type Emoji = {
	content: string;
	url?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
