import { describe, it, expect } from 'vitest';
import { isAnimatedGif, isAnimatedPng, isAnimatedWebp, isAnimatedAvif } from './AnimatedImage';

function bytes(...parts: (string | number[])[]): Uint8Array {
	const data: number[] = [];
	for (const part of parts) {
		if (typeof part === 'string') {
			for (const character of part) {
				data.push(character.charCodeAt(0));
			}
		} else {
			data.push(...part);
		}
	}
	return new Uint8Array(data);
}

const gifHeader = bytes('GIF89a', [0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]);
const gifFrame = bytes(
	[0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00], // image descriptor
	[0x02], // LZW minimum code size
	[0x01, 0xaa, 0x00] // data sub-block and terminator
);
const gifNetscape = bytes([0x21, 0xff, 0x0b], 'NETSCAPE2.0', [0x03, 0x01, 0x00, 0x00, 0x00]);
const gifTrailer = bytes([0x3b]);

describe('isAnimatedGif', () => {
	it('returns false for a single frame', () => {
		expect(isAnimatedGif(bytes([...gifHeader, ...gifFrame, ...gifTrailer]))).toBe(false);
	});

	it('returns true for multiple frames', () => {
		expect(isAnimatedGif(bytes([...gifHeader, ...gifFrame, ...gifFrame, ...gifTrailer]))).toBe(
			true
		);
	});

	it('returns true for the NETSCAPE loop extension', () => {
		expect(isAnimatedGif(bytes([...gifHeader, ...gifNetscape, ...gifFrame]))).toBe(true);
	});

	it('skips the global color table', () => {
		const header = bytes(
			'GIF89a',
			[0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00],
			[0x00, 0x00, 0x00, 0x00, 0x00, 0x00] // global color table (2 entries)
		);
		expect(isAnimatedGif(bytes([...header, ...gifNetscape]))).toBe(true);
	});

	it('returns undefined for truncated data', () => {
		const truncatedFrame = [
			0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0xff
		];
		expect(isAnimatedGif(bytes([...gifHeader, ...truncatedFrame]))).toBeUndefined();
	});

	it('returns undefined for other formats', () => {
		expect(isAnimatedGif(bytes('\x89PNG\r\n\x1a\n'))).toBeUndefined();
		expect(isAnimatedGif(bytes())).toBeUndefined();
	});
});

const pngSignature = bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, dataLength: number): Uint8Array {
	return bytes(
		[0x00, 0x00, 0x00, dataLength],
		type,
		Array.from({ length: dataLength + 4 }, () => 0x00) // data and CRC
	);
}

describe('isAnimatedPng', () => {
	it('returns false when IDAT appears without acTL', () => {
		expect(
			isAnimatedPng(bytes([...pngSignature, ...pngChunk('IHDR', 13), ...pngChunk('IDAT', 4)]))
		).toBe(false);
	});

	it('returns true when acTL appears before IDAT', () => {
		expect(
			isAnimatedPng(bytes([...pngSignature, ...pngChunk('IHDR', 13), ...pngChunk('acTL', 8)]))
		).toBe(true);
	});

	it('returns undefined for truncated data', () => {
		expect(isAnimatedPng(bytes([...pngSignature, ...pngChunk('IHDR', 13)]))).toBeUndefined();
	});

	it('returns undefined for other formats', () => {
		expect(isAnimatedPng(bytes('GIF89a'))).toBeUndefined();
		expect(isAnimatedPng(bytes())).toBeUndefined();
	});
});

function webp(chunk: string, ...rest: number[][]): Uint8Array {
	return bytes('RIFF', [0x00, 0x00, 0x00, 0x00], 'WEBP', chunk, ...rest);
}

describe('isAnimatedWebp', () => {
	it('returns false for simple formats', () => {
		expect(isAnimatedWebp(webp('VP8 '))).toBe(false);
		expect(isAnimatedWebp(webp('VP8L'))).toBe(false);
	});

	it('returns the animation flag of VP8X', () => {
		expect(isAnimatedWebp(webp('VP8X', [0x0a, 0x00, 0x00, 0x00], [0x02]))).toBe(true);
		expect(isAnimatedWebp(webp('VP8X', [0x0a, 0x00, 0x00, 0x00], [0x10]))).toBe(false);
	});

	it('returns undefined for truncated data', () => {
		expect(isAnimatedWebp(webp('VP8X', [0x0a, 0x00, 0x00, 0x00]))).toBeUndefined();
	});

	it('returns undefined for other formats', () => {
		expect(isAnimatedWebp(bytes('GIF89a'))).toBeUndefined();
		expect(isAnimatedWebp(bytes())).toBeUndefined();
	});
});

function ftyp(major: string, ...compatible: string[]): Uint8Array {
	const size = 16 + compatible.length * 4;
	return bytes([0x00, 0x00, 0x00, size], 'ftyp', major, [0x00, 0x00, 0x00, 0x00], ...compatible);
}

describe('isAnimatedAvif', () => {
	it('returns false for still images', () => {
		expect(isAnimatedAvif(ftyp('avif', 'mif1', 'miaf'))).toBe(false);
	});

	it('returns true for the avis major brand', () => {
		expect(isAnimatedAvif(ftyp('avis', 'avif', 'mif1'))).toBe(true);
	});

	it('returns true for the avis compatible brand', () => {
		expect(isAnimatedAvif(ftyp('avif', 'avis', 'miaf'))).toBe(true);
	});

	it('returns undefined for truncated data', () => {
		expect(isAnimatedAvif(ftyp('avif', 'mif1').subarray(0, 18))).toBeUndefined();
	});

	it('returns undefined for other formats', () => {
		expect(isAnimatedAvif(bytes('GIF89a'))).toBeUndefined();
		expect(isAnimatedAvif(bytes())).toBeUndefined();
	});
});
