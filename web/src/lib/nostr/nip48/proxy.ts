const ATPROTO_POST_COLLECTION = 'app.bsky.feed.post';

const DID = /^did:[a-z]+:[A-Za-z0-9._:%-]*[A-Za-z0-9._-]$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const NSID_NAME = /^[A-Za-z][A-Za-z0-9]{0,62}$/;
const RECORD_KEY = /^[A-Za-z0-9._~:-]{1,512}$/;

interface AtUri {
	authority: string;
	collection: string;
	rkey: string;
}

function isDid(value: string): boolean {
	return value.length <= 2048 && DID.test(value);
}

function isHandle(value: string): boolean {
	if (value.length > 253) return false;

	const labels = value.split('.');
	return (
		labels.length >= 2 &&
		labels.every((label) => LABEL.test(label)) &&
		/^[a-z]/.test(labels.at(-1) ?? '')
	);
}

function isNsid(value: string): boolean {
	if (value.length > 317) return false;

	const segments = value.split('.');
	const name = segments.pop();
	const authorityLength = segments.join('.').length;

	return (
		segments.length >= 2 &&
		authorityLength <= 253 &&
		segments.every((segment) => LABEL.test(segment)) &&
		/^[a-z]/.test(segments[0]) &&
		NSID_NAME.test(name ?? '')
	);
}

function isRecordKey(value: string): boolean {
	return value !== '.' && value !== '..' && RECORD_KEY.test(value);
}

function parseAtUri(id: string): AtUri | undefined {
	if (id.length > 8192) return undefined;

	const match = /^at:\/\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)$/.exec(id);
	if (match === null) return undefined;

	const [, authority, collection, rkey] = match;
	if ((!isDid(authority) && !isHandle(authority)) || !isNsid(collection) || !isRecordKey(rkey)) {
		return undefined;
	}

	return { authority, collection, rkey };
}

export function resolveProxyUrl(
	id: string | undefined,
	protocol: string | undefined
): URL | undefined {
	if (id === undefined) return undefined;

	if (protocol === 'atproto') {
		const uri = parseAtUri(id);
		if (uri === undefined || uri.collection !== ATPROTO_POST_COLLECTION) return undefined;

		return new URL(`https://bsky.app/profile/${uri.authority}/post/${uri.rkey}`);
	}

	return new URL(id);
}
