function drawToCanvas(
	element: HTMLCanvasElement,
	image: CanvasImageSource,
	width: number,
	height: number
): void {
	if (width === 0 || height === 0) {
		throw new Error('Image has no dimensions.');
	}

	const context = element.getContext('2d');
	if (context === null) {
		throw new Error('Canvas 2D context is not available.');
	}

	element.width = width;
	element.height = height;
	context.clearRect(0, 0, width, height);
	context.drawImage(image, 0, 0, width, height);
}

async function drawImageElement(element: HTMLCanvasElement, src: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const image = new Image();
		image.decoding = 'sync';
		image.onload = () => {
			try {
				drawToCanvas(element, image, image.naturalWidth, image.naturalHeight);
				resolve();
			} catch (error) {
				reject(error);
			}
		};
		image.onerror = () => {
			reject(new Error('Failed to load image.'));
		};
		image.src = src;
	});
}

async function drawBlobFrame(element: HTMLCanvasElement, src: string): Promise<string> {
	const response = await fetch(src);
	if (!response.ok) {
		throw new Error(`Failed to fetch image: ${response.status}`);
	}

	const blob = await response.blob();
	const url = URL.createObjectURL(blob);
	try {
		if (typeof createImageBitmap === 'function') {
			const bitmap = await createImageBitmap(blob);
			try {
				drawToCanvas(element, bitmap, bitmap.width, bitmap.height);
			} finally {
				bitmap.close();
			}
		} else {
			await drawImageElement(element, url);
		}
	} catch (error) {
		URL.revokeObjectURL(url);
		throw error;
	}

	return url;
}

export function revokeObjectImageSrc(src: string | undefined): void {
	if (src?.startsWith('blob:')) {
		URL.revokeObjectURL(src);
	}
}

export async function drawStillFrame(element: HTMLCanvasElement, src: string): Promise<string> {
	try {
		return await drawBlobFrame(element, src);
	} catch {
		await drawImageElement(element, src);
		return src;
	}
}
