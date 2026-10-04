import { gitSha } from '$lib/build';
import type { RequestHandler } from './$types';

const maxBodyBytes = 8192;
const maxPathLength = 256;
const maxStylesheets = 32;
const maxJavascriptResources = 16;
const maxInitiatorTypeLength = 32;
const maxUserAgentLength = 512;

const stylesheetCheckTriggers = ['load', 'visibilitychange'] as const;

type StylesheetCheckTrigger = (typeof stylesheetCheckTriggers)[number];

type JavascriptResource = {
	path: string;
	initiatorType: string;
	responseStatus: number | null;
};

type StylesheetDetection =
	| { type: 'stylesheet-load-error' }
	| { type: 'stylesheet-not-applied'; trigger: StylesheetCheckTrigger };

type Client = {
	standalone: boolean;
	serviceWorkerControlled: boolean;
	gitSha: string | null;
};

type DiagnosticContext = {
	timestamp: number;
	pathname: string;
	javascriptResources: JavascriptResource[];
	client: Client;
};

type CssDiagnostic = StylesheetDetection & {
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
	javascript: {
		resources: JavascriptResource[];
	};
	client: Client;
};

type JavascriptDiagnostic = {
	type: 'javascript-load-error';
	trigger: 'modulepreload';
	timestamp: number;
	pathname: string;
	javascript: {
		failed: {
			path: string;
			responseStatus: number | null;
		};
		resources: JavascriptResource[];
	};
	client: Client;
};

type ParsedDiagnostic =
	| { message: 'client-css-diagnostic'; diagnostic: CssDiagnostic }
	| { message: 'client-javascript-diagnostic'; diagnostic: JavascriptDiagnostic };

const redactedPagePathSegmentPattern =
	/^(?:|[a-z]{1,32}|\d{1,4}|\[(?:npub|nprofile|note|nevent|naddr|param)\])$/;
// Printable ASCII without query or hash, since only pathnames are accepted.
const stylesheetPathPattern = /^\/(?:(?![?#])[\x21-\x7e])*$/;
const javascriptPathPattern = /^\/_app\/immutable\/(?:(?![?#])[\x21-\x7e])*\.js$/;
// Lowercase words joined by hyphens, such as script, link, or early-hints.
const initiatorTypePattern = /^[a-z]+(?:-[a-z]+)*$/;
// Full commit SHA from WORKERS_CI_COMMIT_SHA.
const gitShaPattern = /^[0-9a-f]{40}$/;

const isStylesheetCheckTrigger = (value: unknown): value is StylesheetCheckTrigger =>
	stylesheetCheckTriggers.some((trigger) => trigger === value);

const parseStylesheetDetection = (
	type: unknown,
	trigger: unknown
): StylesheetDetection | undefined => {
	if (type === 'stylesheet-load-error' && trigger === undefined) {
		return { type };
	}
	if (type === 'stylesheet-not-applied' && isStylesheetCheckTrigger(trigger)) {
		return { type, trigger };
	}
	return undefined;
};

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

// 0 is a valid responseStatus value; null means Resource Timing did not expose a status.
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

const isJavascriptPath = (value: unknown): value is string =>
	typeof value === 'string' && value.length <= maxPathLength && javascriptPathPattern.test(value);

const isJavascriptResource = (value: unknown): value is JavascriptResource => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}
	const { path, initiatorType, responseStatus } = value as Record<string, unknown>;
	return (
		isJavascriptPath(path) &&
		typeof initiatorType === 'string' &&
		initiatorType.length <= maxInitiatorTypeLength &&
		initiatorTypePattern.test(initiatorType) &&
		isResponseStatus(responseStatus)
	);
};

const isJavascriptResources = (value: unknown): value is JavascriptResource[] =>
	Array.isArray(value) &&
	value.length <= maxJavascriptResources &&
	value.every(isJavascriptResource);

const isGitSha = (value: unknown): value is string =>
	typeof value === 'string' && gitShaPattern.test(value);

const isTimestamp = (value: unknown): value is number =>
	Number.isSafeInteger(value) && (value as number) > 0;

const parseContext = ({
	pathname,
	javascriptResources,
	timestamp,
	standalone,
	serviceWorkerControlled,
	gitSha
}: Record<string, unknown>): DiagnosticContext | undefined => {
	if (
		!isRedactedPagePathname(pathname) ||
		!isJavascriptResources(javascriptResources) ||
		!isTimestamp(timestamp) ||
		typeof standalone !== 'boolean' ||
		typeof serviceWorkerControlled !== 'boolean' ||
		(gitSha !== undefined && !isGitSha(gitSha))
	) {
		return undefined;
	}
	return {
		timestamp,
		pathname,
		javascriptResources: javascriptResources.map(({ path, initiatorType, responseStatus }) => ({
			path,
			initiatorType,
			responseStatus
		})),
		client: {
			standalone,
			serviceWorkerControlled,
			gitSha: gitSha ?? null
		}
	};
};

const parseCssDiagnostic = (
	{
		type,
		trigger,
		stylesheetPath,
		stylesheetPaths,
		stylesheetResponseStatuses,
		unavailableStylesheetPaths
	}: Record<string, unknown>,
	{ timestamp, pathname, javascriptResources, client }: DiagnosticContext
): CssDiagnostic | undefined => {
	const detection = parseStylesheetDetection(type, trigger);
	if (
		detection === undefined ||
		(stylesheetPath !== undefined && !isStylesheetPath(stylesheetPath)) ||
		!isStylesheetPaths(stylesheetPaths) ||
		!isStylesheetResponseStatuses(stylesheetResponseStatuses, stylesheetPaths) ||
		!isStylesheetPaths(unavailableStylesheetPaths)
	) {
		return undefined;
	}
	return {
		...detection,
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
		javascript: {
			resources: javascriptResources
		},
		client
	};
};

const parseJavascriptDiagnostic = (
	{ trigger, javascriptPath, javascriptResponseStatus }: Record<string, unknown>,
	{ timestamp, pathname, javascriptResources, client }: DiagnosticContext
): JavascriptDiagnostic | undefined => {
	if (
		trigger !== 'modulepreload' ||
		!isJavascriptPath(javascriptPath) ||
		!isResponseStatus(javascriptResponseStatus)
	) {
		return undefined;
	}
	return {
		type: 'javascript-load-error',
		trigger,
		timestamp,
		pathname,
		javascript: {
			failed: {
				path: javascriptPath,
				responseStatus: javascriptResponseStatus
			},
			resources: javascriptResources
		},
		client
	};
};

const parseDiagnostic = (value: unknown): ParsedDiagnostic | undefined => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}
	const fields = value as Record<string, unknown>;
	const context = parseContext(fields);
	if (context === undefined) {
		return undefined;
	}
	if (fields.type === 'javascript-load-error') {
		const diagnostic = parseJavascriptDiagnostic(fields, context);
		return diagnostic && { message: 'client-javascript-diagnostic', diagnostic };
	}
	const diagnostic = parseCssDiagnostic(fields, context);
	return diagnostic && { message: 'client-css-diagnostic', diagnostic };
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

	const parsed = parseDiagnostic(payload);
	if (parsed === undefined) {
		return new Response(null, { status: 400 });
	}

	const { message, diagnostic } = parsed;
	console.error({
		message,
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
