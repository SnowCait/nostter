export const shortcodeRegexp = /^[\w-]+$/;

export const filterEmojiTags = (tags: string[][]): string[][] => {
	return tags.filter(([tagName, shortcode, imageUrl]) => {
		if (tagName !== 'emoji') {
			return false;
		}
		if (shortcode === undefined || imageUrl === undefined) {
			return false;
		}
		if (!shortcodeRegexp.test(shortcode)) {
			return false;
		}
		try {
			new URL(imageUrl);
			return true;
		} catch {
			return false;
		}
	});
};
