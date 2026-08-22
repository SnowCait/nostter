const ATPROTO_POST_COLLECTION = 'app.bsky.feed.post';

const DID_AUTHORITY = /^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/;
const HANDLE_AUTHORITY = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/;
const COLLECTION = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9]*$/;
const RECORD_KEY = /^[A-Za-z0-9._~:-]{1,512}$/;

interface AtUri {
	authority: string;
	collection: string;
	rkey: string;
}

function parseAtUri(id: string): AtUri | undefined {
	const match = /^at:\/\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)$/.exec(id);
	if (match === null) return undefined;

	const [, authority, collection, rkey] = match;
	if (
		(!DID_AUTHORITY.test(authority) && !HANDLE_AUTHORITY.test(authority)) ||
		!COLLECTION.test(collection) ||
		!RECORD_KEY.test(rkey) ||
		rkey === '.' ||
		rkey === '..'
	) {
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
