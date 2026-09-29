import { gitSha } from '$lib/build';
import type { RequestHandler } from './$types';

const maxBodyBytes = 4096;
const maxPathLength = 256;
const maxStylesheets = 32;
const maxUserAgentLength = 512;

const diagnosticTypes = ['stylesheet-load-error', 'stylesheet-not-applied'] as const;

type CssDiagnostic = {
	type: (typeof diagnosticTypes)[number];
	timestamp: number;
	pathname: string;
	stylesheets: {
		failed?: string;
		resources: {
			path: string;
			responseStatus: number | null;
		}[];
		unavailable: string[];
	};
	client: {
		standalone: boolean;
		serviceWorkerControlled: boolean;
	};
};

const redactedPagePathSegmentPattern =
	/^(?:|[a-z]{1,32}|\d{1,4}|\[(?:npub|nprofile|note|nevent|naddr|param)\])$/;
// Printable ASCII without query or hash, since only pathnames are accepted.
const stylesheetPathPattern = /^\/(?:(?![?#])[\x21-\x7e])*$/;

const isDiagnosticType = (value: unknown): value is CssDiagnostic['type'] =>
	diagnosticTypes.some((type) => type === value);

const isRedactedPagePathname = (value: unknown): value is string =>
	typeof value === 'string' &&
	value.length <= maxPathLength &&
	value.startsWith('/') &&
	value
		.slice(1)
		.split('/')
		.every((segment) => redactedPagePathSegmentPattern.test(segment));

const isStylesheetPath = (value: unknown): value is string =>
	typeof value === 'string' && value.length <= maxPathLength && stylesheetPathPattern.test(value);

const isStylesheetPaths = (value: unknown): value is string[] =>
	Array.isArray(value) && value.length <= maxStylesheets && value.every(isStylesheetPath);

// 0 is reported for network errors and responses without a visible status.
const isResponseStatus = (value: unknown): value is number | null =>
	value === null ||
	(Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 999);

const isStylesheetResponseStatuses = (
	value: unknown,
	stylesheetPaths: string[]
): value is (number | null)[] =>
	Array.isArray(value) &&
	value.length === stylesheetPaths.length &&
	value.every(isResponseStatus);

const isTimestamp = (value: unknown): value is number =>
	Number.isSafeInteger(value) && (value as number) > 0;

const parseDiagnostic = (value: unknown): CssDiagnostic | undefined => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}
	const {
		type,
		pathname,
		stylesheetPath,
		stylesheetPaths,
		stylesheetResponseStatuses,
		unavailableStylesheetPaths,
		timestamp,
		standalone,
		serviceWorkerControlled
	} = value as Record<string, unknown>;
	if (
		!isDiagnosticType(type) ||
		!isRedactedPagePathname(pathname) ||
		(stylesheetPath !== undefined && !isStylesheetPath(stylesheetPath)) ||
		!isStylesheetPaths(stylesheetPaths) ||
		!isStylesheetResponseStatuses(stylesheetResponseStatuses, stylesheetPaths) ||
		!isStylesheetPaths(unavailableStylesheetPaths) ||
		!isTimestamp(timestamp) ||
		typeof standalone !== 'boolean' ||
		typeof serviceWorkerControlled !== 'boolean'
	) {
		return undefined;
	}
	return {
		type,
		timestamp,
		pathname,
		stylesheets: {
			failed: stylesheetPath,
			resources: stylesheetPaths.map((path, i) => ({
				path,
				responseStatus: stylesheetResponseStatuses[i]
			})),
			unavailable: unavailableStylesheetPaths
		},
		client: {
			standalone,
			serviceWorkerControlled
		}
	};
};

const readLimitedText = async (request: Request): Promise<string | undefined> => {
	if (request.body === null) {
		return '';
	}
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let text = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			return text + decoder.decode();
		}
		size += value.byteLength;
		if (size > maxBodyBytes) {
			await reader.cancel();
			return undefined;
		}
		text += decoder.decode(value, { stream: true });
	}
};

const isJsonContentType = (contentType: string | null): boolean =>
	contentType?.split(';')[0].trim().toLowerCase() === 'application/json';

export const POST: RequestHandler = async ({ request, url }) => {
	const origin = request.headers.get('origin');
	if (origin !== null && origin !== url.origin) {
		return new Response(null, { status: 403 });
	}
	if (!isJsonContentType(request.headers.get('content-type'))) {
		return new Response(null, { status: 415 });
	}
	if (Number(request.headers.get('content-length')) > maxBodyBytes) {
		return new Response(null, { status: 413 });
	}

	const body = await readLimitedText(request);
	if (body === undefined) {
		return new Response(null, { status: 413 });
	}

	let payload: unknown;
	try {
		payload = JSON.parse(body);
	} catch {
		return new Response(null, { status: 400 });
	}

	const diagnostic = parseDiagnostic(payload);
	if (diagnostic === undefined) {
		return new Response(null, { status: 400 });
	}

	console.error({
		message: 'client-css-diagnostic',
		diagnostic: {
			...diagnostic,
			client: {
				...diagnostic.client,
				userAgent: request.headers.get('user-agent')?.slice(0, maxUserAgentLength)
			},
			server: { gitSha }
		}
	});

	return new Response(null, { status: 204 });
};
