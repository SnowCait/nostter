import { gitSha } from '$lib/build';

export type UnexpectedErrorType = 'window-error' | 'unhandled-rejection' | 'sveltekit-handle-error';

export type ErrorDetails = {
	name?: string;
	message: string;
	stack?: string;
	filename?: string;
	line?: number;
	column?: number;
};

type UnexpectedErrorDiagnostic = ErrorDetails & {
	type: UnexpectedErrorType;
	timestamp: number;
	pathname: string;
	standalone: boolean;
	serviceWorkerControlled: boolean;
	gitSha?: string;
};

const endpoint = '/api/diagnostics/client';
const maxBodyBytes = 8192;
const maxNameLength = 128;
const maxMessageLength = 1024;
const maxStackLength = 4096;
const maxPathLength = 256;
const immutableAssetPathPrefix = '/_app/immutable/';

const boundedString = (value: unknown, maxLength: number): string | undefined =>
	typeof value === 'string' ? value.slice(0, maxLength) : undefined;

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

const describeNonError = (value: unknown): string => {
	switch (typeof value) {
		case 'string':
			return value.slice(0, maxMessageLength);
		case 'number':
		case 'bigint':
		case 'boolean':
		case 'undefined':
			return String(value).slice(0, maxMessageLength);
		default:
			return value === null ? 'null' : `[${typeof value}]`;
	}
};

export function describeError(value: unknown): ErrorDetails {
	if (value instanceof Error) {
		return {
			name: boundedString(value.name, maxNameLength),
			message: boundedString(value.message, maxMessageLength) ?? '',
			stack: boundedString(value.stack, maxStackLength)
		};
	}
	return { message: describeNonError(value) };
}

export function describeErrorEvent(
	event: Pick<ErrorEvent, 'error' | 'message' | 'filename' | 'lineno' | 'colno'>,
	base: string
): ErrorDetails {
	// Cross-origin script errors have no error object, only a generic message such as "Script error.".
	const details =
		event.error === null || event.error === undefined
			? { message: boundedString(event.message, maxMessageLength) ?? '' }
			: describeError(event.error);
	return {
		...details,
		filename: toSourcePath(event.filename, base),
		line: positiveInteger(event.lineno),
		column: positiveInteger(event.colno)
	};
}

const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

// Escaped or multibyte characters can exceed the body limit even within the length limits, so the stack is shortened.
export function serializeDiagnostic(diagnostic: UnexpectedErrorDiagnostic): string {
	let body = JSON.stringify(diagnostic);
	let stack = diagnostic.stack;
	while (stack !== undefined && byteLength(body) > maxBodyBytes) {
		stack = stack.slice(0, Math.floor(stack.length / 2)) || undefined;
		body = JSON.stringify({ ...diagnostic, stack });
	}
	return body;
}

const postDiagnostic = (type: UnexpectedErrorType, details: ErrorDetails): void => {
	const body = serializeDiagnostic({
		type,
		...details,
		timestamp: Date.now(),
		pathname: redactPathname(location.pathname),
		standalone:
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true,
		serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
		...(gitSha ? { gitSha } : {})
	});
	fetch(endpoint, {
		method: 'POST',
		keepalive: true,
		headers: { 'Content-Type': 'application/json' },
		body
	}).catch(() => {});
};

export function createUnexpectedErrorReporter(
	send: (type: UnexpectedErrorType, details: ErrorDetails) => void
): (type: UnexpectedErrorType, describe: () => ErrorDetails) => void {
	const sentTypes = new Set<UnexpectedErrorType>();
	return (type, describe) => {
		if (sentTypes.has(type)) {
			return;
		}
		sentTypes.add(type);
		try {
			send(type, describe());
		} catch {
			// Best-effort diagnostics must not raise errors that would be reported again.
		}
	};
}

const report = createUnexpectedErrorReporter(postDiagnostic);

export function observeUnexpectedErrors(): void {
	// Registered without capture so resource load errors, which do not bubble, are left to app.html.
	addEventListener('error', (event) => {
		report('window-error', () => describeErrorEvent(event, location.href));
	});
	addEventListener('unhandledrejection', (event) => {
		report('unhandled-rejection', () => describeError(event.reason));
	});
}

export function reportSvelteKitError(error: unknown): void {
	report('sveltekit-handle-error', () => describeError(error));
}
