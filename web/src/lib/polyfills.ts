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

if (!Promise.withResolvers) {
	Promise.withResolvers = function <T>(this: PromiseConstructor): PromiseWithResolvers<T> {
		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason?: unknown) => void;
		const promise = new this<T>((resolvePromise, rejectPromise) => {
			resolve = resolvePromise;
			reject = rejectPromise;
		});

		return { promise, resolve, reject };
	};
}

export {};
