import { gitSha } from '$lib/build';

export type UnexpectedErrorType = 'window-error' | 'unhandled-rejection' | 'sveltekit-handle-error';

export type SourceLocation = {
	filename?: string;
	line?: number;
	column?: number;
};

const endpoint = '/api/diagnostics/client';
const maxPathLength = 256;
const immutableAssetPathPrefix = '/_app/immutable/';

const positiveInteger = (value: unknown): number | undefined =>
	Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : undefined;

// Mirrors redactPathname in app.html, which cannot import app modules.
export function redactPathname(pathname: string): string {
	return pathname
		.split('/')
		.map((segment) => {
			if (segment === '' || /^[a-z]{1,32}$/.test(segment) || /^\d{1,4}$/.test(segment)) {
				return segment;
			}
			const entity = /^(?:nostr%3a)?(npub|nprofile|note|nevent|naddr)1/i.exec(segment);
			return entity === null ? '[param]' : `[${entity[1].toLowerCase()}]`;
		})
		.join('/');
}

// Inline scripts report the document URL as their filename, so non-asset paths are redacted like page paths.
export function toSourcePath(filename: string, base: string): string | undefined {
	if (filename === '') {
		return undefined;
	}
	try {
		const url = new URL(filename, base);
		if (url.origin !== new URL(base).origin) {
			return undefined;
		}
		const path = url.pathname.startsWith(immutableAssetPathPrefix)
			? url.pathname
			: redactPathname(url.pathname);
		return path.length <= maxPathLength ? path : undefined;
	} catch {
		return undefined;
	}
}

export function toSourceLocation(
	event: Pick<ErrorEvent, 'filename' | 'lineno' | 'colno'>,
	base: string
): SourceLocation {
	return {
		filename: toSourcePath(event.filename, base),
		line: positiveInteger(event.lineno),
		column: positiveInteger(event.colno)
	};
}

const postDiagnostic = (type: UnexpectedErrorType, source?: SourceLocation): void => {
	fetch(endpoint, {
		method: 'POST',
		keepalive: true,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type,
			...source,
			timestamp: Date.now(),
			pathname: redactPathname(location.pathname),
			standalone:
				matchMedia('(display-mode: standalone)').matches ||
				(navigator as { standalone?: boolean }).standalone === true,
			serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
			...(gitSha ? { gitSha } : {})
		})
	}).catch(() => {});
};

export function createUnexpectedErrorReporter(
	send: (type: UnexpectedErrorType, source?: SourceLocation) => void
): (type: UnexpectedErrorType, locate?: () => SourceLocation) => void {
	const sentTypes = new Set<UnexpectedErrorType>();
	return (type, locate) => {
		if (sentTypes.has(type)) {
			return;
		}
		sentTypes.add(type);
		try {
			send(type, locate?.());
		} catch {
			// Best-effort diagnostics must not raise errors that would be reported again.
		}
	};
}

const report = createUnexpectedErrorReporter(postDiagnostic);

export function observeUnexpectedErrors(): void {
	// Registered without capture so resource load errors, which do not bubble, are left to app.html.
	addEventListener('error', (event) => {
		report('window-error', () => toSourceLocation(event, location.href));
	});
	addEventListener('unhandledrejection', () => {
		report('unhandled-rejection');
	});
}

export function reportSvelteKitHandleError(): void {
	report('sveltekit-handle-error');
}
