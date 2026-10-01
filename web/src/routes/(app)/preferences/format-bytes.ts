const units = ['B', 'KiB', 'MiB', 'GiB'] as const;

export function formatBytes(bytes: number, locale = 'en'): string {
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${units[unit]}`;
}
