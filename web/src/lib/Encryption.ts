import { Signer } from './Signer';

export async function isDecodable(pubkey: string, content: string): Promise<boolean> {
	try {
		await Signer.decrypt(pubkey, content);
		return true;
	} catch (error) {
		return false;
	}
}

export async function parsePrivateTags(pubkey: string, content: string): Promise<string[][]> {
	if (content === '') {
		return [];
	}

	try {
		const tags = await Signer.decrypt(pubkey, content);
		return JSON.parse(tags);
	} catch (error) {
		console.warn('[private content parse error]', pubkey, content);
		return [];
	}
}
