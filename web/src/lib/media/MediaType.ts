const imageExtensions = ['apng', 'avif', 'gif', 'jpg', 'jpeg', 'png', 'webp', 'bmp'];
const audioExtensions = ['mp3', 'm4a', 'wav', 'ogg'];
const videoExtensions = ['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi', 'm4v'];

const extensionRegexp = (extensions: string[]): RegExp =>
	new RegExp(`\\.(${extensions.join('|')})$`, 'i');

const imageExtensionRegexp = extensionRegexp(imageExtensions);
const audioExtensionRegexp = extensionRegexp(audioExtensions);
const videoExtensionRegexp = extensionRegexp(videoExtensions);

export const mediaExtensionRegexp = extensionRegexp([
	...imageExtensions,
	...audioExtensions,
	...videoExtensions
]);

export type MediaKind = 'image' | 'audio' | 'video';

export function mediaKindFromPathname(pathname: string): MediaKind | undefined {
	if (imageExtensionRegexp.test(pathname)) {
		return 'image';
	}
	if (audioExtensionRegexp.test(pathname)) {
		return 'audio';
	}
	if (videoExtensionRegexp.test(pathname)) {
		return 'video';
	}
	return undefined;
}
