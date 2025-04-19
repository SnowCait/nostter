if (!URL.canParse) {
	URL.canParse = (url: string | URL, base?: string | URL): boolean => {
		try {
			new URL(url, base);
			return true;
		} catch {
			return false;
		}
	};
}
