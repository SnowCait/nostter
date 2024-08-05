export const formatStyleFromObject = (styleObj: Record<string, string>) => {
	return Object.entries(styleObj).reduce((acc, [key, value]) => `${acc} ${key}: ${value};`, '');
};
