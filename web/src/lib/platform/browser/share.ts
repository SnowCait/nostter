export async function shareUrl(url: string): Promise<boolean> {
	const data: ShareData = { url };
	if (navigator.canShare !== undefined && navigator.canShare(data)) {
		await navigator.share(data);
		return true;
	} else {
		return false;
	}
}
