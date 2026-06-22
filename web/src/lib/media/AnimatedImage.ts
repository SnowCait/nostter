import { httpProxy } from '$lib/Constants';

// Animation markers appear near the start of each container; 16 KB also covers
// most GIF first frames so that static GIFs can reach a decisive block
const headLength = 16384;

const cache = new Map<string, Promise<boolean | undefined>>();

// undefined means the animation could not be determined
export function isAnimatedImage(url: string): Promise<boolean | undefined> {
	let result = cache.get(url);
	if (result === undefined) {
		result = fetchHead(url)
			.then(
				(bytes) =>
					isAnimatedGif(bytes) ??
					isAnimatedPng(bytes) ??
					isAnimatedWebp(bytes) ??
					isAnimatedAvif(bytes)
			)
			.catch(() => undefined);
		cache.set(url, result);
	}
	return result;
}

async function fetchHead(url: string): Promise<Uint8Array> {
	try {
		return await readHead(await fetch(url));
	} catch {
		return await readHead(await fetch(`${httpProxy}/?url=${encodeURIComponent(url)}`));
	}
}

async function readHead(response: Response): Promise<Uint8Array> {
	if (!response.ok || response.body === null) {
		throw new Error(`Failed to fetch: ${response.status}`);
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;
	while (length < headLength) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunks.push(value);
		length += value.length;
	}
	await reader.cancel();
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

export function isAnimatedGif(bytes: Uint8Array): boolean | undefined {
	if (ascii(bytes, 0, 4) !== 'GIF8' || bytes.length < 13) {
		return undefined;
	}
	let offset = 13 + colorTableLength(bytes[10]);
	let frames = 0;
	while (offset >= 0 && offset < bytes.length) {
		const block = bytes[offset];
		if (block === 0x3b) {
			return frames >= 2;
		} else if (block === 0x2c) {
			frames++;
			if (frames >= 2) {
				return true;
			}
			if (offset + 10 > bytes.length) {
				return undefined;
			}
			offset += 10 + colorTableLength(bytes[offset + 9]) + 1;
			offset = skipSubBlocks(bytes, offset);
		} else if (block === 0x21) {
			if (ascii(bytes, offset + 3, 11) === 'NETSCAPE2.0') {
				return true; // the loop extension is only used by animations
			}
			offset = skipSubBlocks(bytes, offset + 2);
		} else {
			return undefined;
		}
	}
	return undefined;
}

export function isAnimatedPng(bytes: Uint8Array): boolean | undefined {
	if (ascii(bytes, 0, 8) !== '\x89PNG\r\n\x1a\n') {
		return undefined;
	}
	let offset = 8;
	while (offset + 8 <= bytes.length) {
		const length = uint32(bytes, offset);
		const type = ascii(bytes, offset + 4, 4);
		if (type === 'acTL') {
			return true;
		}
		if (type === 'IDAT') {
			return false; // the animation control chunk must precede IDAT
		}
		offset += 12 + length;
	}
	return undefined;
}

export function isAnimatedWebp(bytes: Uint8Array): boolean | undefined {
	if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
		return undefined;
	}
	const chunk = ascii(bytes, 12, 4);
	if (chunk === 'VP8 ' || chunk === 'VP8L') {
		return false;
	}
	if (chunk === 'VP8X' && bytes.length > 20) {
		return (bytes[20] & 0x02) !== 0;
	}
	return undefined;
}

export function isAnimatedAvif(bytes: Uint8Array): boolean | undefined {
	if (ascii(bytes, 4, 4) !== 'ftyp') {
		return undefined;
	}
	const size = uint32(bytes, 0);
	if (size < 16 || size % 4 !== 0) {
		return undefined;
	}
	const end = Math.min(size, bytes.length);
	for (let offset = 8; offset + 4 <= end; offset += 4) {
		if (ascii(bytes, offset, 4) === 'avis') {
			return true; // the image sequence brand
		}
	}
	return size <= bytes.length ? false : undefined;
}

function colorTableLength(packedField: number): number {
	return (packedField & 0x80) !== 0 ? 3 * 2 ** ((packedField & 0x07) + 1) : 0;
}

function skipSubBlocks(bytes: Uint8Array, offset: number): number {
	while (offset < bytes.length) {
		const size = bytes[offset];
		if (size === 0) {
			return offset + 1;
		}
		offset += size + 1;
	}
	return -1;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
	return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function uint32(bytes: Uint8Array, offset: number): number {
	return (
		bytes[offset] * 0x1000000 +
		((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
	);
}
