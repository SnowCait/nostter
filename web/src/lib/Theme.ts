export type Theme = 'system' | 'light' | 'dark';

export function resolveTheme(theme: Theme): 'light' | 'dark' {
	if (theme === 'system') {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	return theme;
}

export function updateThemeColor(): void {
	const color = getComputedStyle(document.documentElement).getPropertyValue('--background');
	const themeColorMetaTag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (themeColorMetaTag !== null) {
		themeColorMetaTag.content = color;
	}
}

export function applyTheme(theme: Theme): void {
	document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark');
	updateThemeColor();
}
