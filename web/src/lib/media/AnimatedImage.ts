export type AnimatedImageType = 'gif' | 'png' | 'webp' | 'avif';

type ImageDecoderTrack = {
	animated?: boolean;
	frameCount?: number;
};

type ImageDecoderTrackList = {
	ready: Promise<ImageDecoderTrackList>;
	selectedTrack?: ImageDecoderTrack;
};

type ImageDecoderInstance = {
	close(): void;
	tracks: ImageDecoderTrackList;
};

type ImageDecoderConstructor = {
	new (init: { data: ArrayBuffer; type: string }): ImageDecoderInstance;
	isTypeSupported?: (type: string) => Promise<boolean>;
};

const animatedImageCache = new Map<string, Promise<boolean>>();
const gifSignature = [0x47, 0x49, 0x46, 0x38];
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const webpSignature = [0x52, 0x49, 0x46, 0x46];

export function getAnimatedImageType(
	mimeType: string | null | undefined,
	pathname: string
): AnimatedImageType | undefined {
	const normalizedMimeType = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
	if (normalizedMimeType === 'image/gif' || /\.gif$/i.test(pathname)) {
		return 'gif';
	}
	if (
		normalizedMimeType === 'image/png' ||
		normalizedMimeType === 'image/apng' ||
		/\.(apng|png)$/i.test(pathname)
	) {
		return 'png';
	}
	if (normalizedMimeType === 'image/webp' || /\.webp$/i.test(pathname)) {
		return 'webp';
	}
	if (normalizedMimeType === 'image/avif' || /\.avif$/i.test(pathname)) {
		return 'avif';
	}

	return undefined;
}

export function detectAnimatedImage(src: string, type: AnimatedImageType): Promise<boolean> {
	const cacheKey = `${type}:${src}`;
	const cached = animatedImageCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	const promise = detectAnimatedImageUncached(src, type);
	animatedImageCache.set(cacheKey, promise);
	return promise;
}

function getAscii(bytes: Uint8Array, offset: number, length: number): string {
	if (offset + length > bytes.length) {
		return '';
	}

	return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function isBytes(bytes: Uint8Array, offset: number, expected: number[]): boolean {
	return expected.every((byte, index) => bytes[offset + index] === byte);
}

function getImageDecoderType(type: AnimatedImageType): string {
	switch (type) {
		case 'gif':
			return 'image/gif';
		case 'png':
			return 'image/png';
		case 'webp':
			return 'image/webp';
		case 'avif':
			return 'image/avif';
	}
}

function getImageDecoder(): ImageDecoderConstructor | undefined {
	return (globalThis as typeof globalThis & { ImageDecoder?: ImageDecoderConstructor })
		.ImageDecoder;
}

async function canUseImageDecoder(type: AnimatedImageType): Promise<boolean> {
	const decoder = getImageDecoder();
	if (decoder === undefined) {
		return false;
	}
	if (decoder.isTypeSupported === undefined) {
		return true;
	}

	try {
		return await decoder.isTypeSupported(getImageDecoderType(type));
	} catch {
		return false;
	}
}

async function detectWithImageDecoder(
	buffer: ArrayBuffer,
	type: AnimatedImageType
): Promise<boolean | undefined> {
	const Decoder = getImageDecoder();
	if (Decoder === undefined) {
		return undefined;
	}

	const decoder = new Decoder({
		data: buffer.slice(0),
		type: getImageDecoderType(type)
	});
	try {
		const tracks = await decoder.tracks.ready;
		const track = tracks.selectedTrack;
		if (track === undefined) {
			return undefined;
		}

		return track.animated === true || (track.frameCount ?? 1) > 1;
	} finally {
		decoder.close();
	}
}

function skipGifSubBlocks(bytes: Uint8Array, offset: number): number | undefined {
	while (offset < bytes.length) {
		const length = bytes[offset];
		offset += 1;
		if (length === 0) {
			return offset;
		}
		offset += length;
	}

	return undefined;
}

function parseAnimatedGif(buffer: ArrayBuffer): boolean | undefined {
	const bytes = new Uint8Array(buffer);
	if (!isBytes(bytes, 0, gifSignature) || bytes.length < 13) {
		return false;
	}

	let offset = 13;
	const packed = bytes[10];
	if ((packed & 0x80) !== 0) {
		offset += 3 * 2 ** ((packed & 0x07) + 1);
	}

	let frames = 0;
	while (offset < bytes.length) {
		const introducer = bytes[offset];
		if (introducer === 0x3b) {
			return frames > 1;
		}
		if (introducer === 0x21) {
			const nextOffset = skipGifSubBlocks(bytes, offset + 2);
			if (nextOffset === undefined) {
				return undefined;
			}
			offset = nextOffset;
			continue;
		}
		if (introducer !== 0x2c) {
			return false;
		}
		if (offset + 10 > bytes.length) {
			return undefined;
		}

		frames += 1;
		if (frames > 1) {
			return true;
		}

		const imagePacked = bytes[offset + 9];
		offset += 10;
		if ((imagePacked & 0x80) !== 0) {
			offset += 3 * 2 ** ((imagePacked & 0x07) + 1);
		}
		if (offset >= bytes.length) {
			return undefined;
		}

		offset = skipGifSubBlocks(bytes, offset + 1) ?? bytes.length;
		if (offset === bytes.length) {
			return undefined;
		}
	}

	return undefined;
}

function parseAnimatedPng(buffer: ArrayBuffer): boolean | undefined {
	const bytes = new Uint8Array(buffer);
	if (!isBytes(bytes, 0, pngSignature)) {
		return false;
	}

	const view = new DataView(buffer);
	let offset = pngSignature.length;
	while (offset + 12 <= bytes.length) {
		const length = view.getUint32(offset);
		const type = getAscii(bytes, offset + 4, 4);
		const nextOffset = offset + 12 + length;

		if (nextOffset > bytes.length) {
			return undefined;
		}
		if (type === 'acTL') {
			return true;
		}
		if (type === 'IDAT' || type === 'IEND') {
			return false;
		}

		offset = nextOffset;
	}

	return undefined;
}

function parseAnimatedWebp(buffer: ArrayBuffer): boolean | undefined {
	const bytes = new Uint8Array(buffer);
	if (!isBytes(bytes, 0, webpSignature) || getAscii(bytes, 8, 4) !== 'WEBP') {
		return false;
	}

	const view = new DataView(buffer);
	let offset = 12;
	while (offset + 8 <= bytes.length) {
		const type = getAscii(bytes, offset, 4);
		const length = view.getUint32(offset + 4, true);
		const dataOffset = offset + 8;
		const nextOffset = dataOffset + length + (length % 2);

		if (nextOffset > bytes.length) {
			return undefined;
		}
		if (type === 'ANIM' || type === 'ANMF') {
			return true;
		}
		if (type === 'VP8X' && length > 0 && (bytes[dataOffset] & 0x02) !== 0) {
			return true;
		}

		offset = nextOffset;
	}

	return false;
}

function parseAnimatedAvif(buffer: ArrayBuffer): boolean | undefined {
	const bytes = new Uint8Array(buffer);
	if (bytes.length < 16) {
		return undefined;
	}

	const view = new DataView(buffer);
	let offset = 0;
	while (offset + 8 <= bytes.length) {
		const size = view.getUint32(offset);
		const type = getAscii(bytes, offset + 4, 4);
		if (size < 8 || offset + size > bytes.length) {
			return undefined;
		}
		if (type !== 'ftyp') {
			offset += size;
			continue;
		}

		if (getAscii(bytes, offset + 8, 4) === 'avis') {
			return true;
		}
		for (let brandOffset = offset + 16; brandOffset + 4 <= offset + size; brandOffset += 4) {
			if (getAscii(bytes, brandOffset, 4) === 'avis') {
				return true;
			}
		}

		return false;
	}

	return undefined;
}

function parseAnimatedImage(buffer: ArrayBuffer, type: AnimatedImageType): boolean | undefined {
	switch (type) {
		case 'gif':
			return parseAnimatedGif(buffer);
		case 'png':
			return parseAnimatedPng(buffer);
		case 'webp':
			return parseAnimatedWebp(buffer);
		case 'avif':
			return parseAnimatedAvif(buffer);
	}
}

async function fetchImageBytes(src: string, headers?: HeadersInit): Promise<ArrayBuffer> {
	const response = await fetch(src, { headers });
	if (!response.ok) {
		throw new Error(`Failed to fetch image bytes: ${response.status}`);
	}

	return await response.arrayBuffer();
}

async function detectAnimatedImageUncached(src: string, type: AnimatedImageType): Promise<boolean> {
	if (await canUseImageDecoder(type)) {
		let buffer: ArrayBuffer;
		try {
			buffer = await fetchImageBytes(src);
		} catch {
			return true;
		}

		try {
			const decoded = await detectWithImageDecoder(buffer, type);
			if (decoded !== undefined) {
				return decoded;
			}
		} catch {
			// Fall back to container scanning when ImageDecoder cannot inspect the image.
		}

		return parseAnimatedImage(buffer, type) === true;
	}

	try {
		const partial = parseAnimatedImage(
			await fetchImageBytes(src, {
				Range: 'bytes=0-262143'
			}),
			type
		);
		if (partial !== undefined) {
			return partial;
		}
	} catch {
		return true;
	}

	try {
		return parseAnimatedImage(await fetchImageBytes(src), type) === true;
	} catch {
		return true;
	}
}
