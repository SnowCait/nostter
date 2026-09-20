export function sharedContent(
	title: string | null,
	text: string | null,
	url: string | null
): string {
	const params = [
		...new Set(
			[title, text, url].filter(
				(param): param is string => param !== null && param.trim() !== ''
			)
		)
	];
	return params
		.filter((param) => !params.some((other) => other !== param && other.includes(param)))
		.join('\n');
}
