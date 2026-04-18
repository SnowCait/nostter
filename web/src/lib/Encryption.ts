import { Signer } from './Signer';

export async function isDecodable(pubkey: string, content: string): Promise<boolean> {
	try {
		await Signer.decrypt(pubkey, content);
		return true;
	} catch {
		return false;
	}
}
