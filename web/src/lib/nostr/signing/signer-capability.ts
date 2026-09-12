export type LoginType = 'NIP-07' | 'NIP-46' | 'nsec' | 'npub';

export const signerCanSign = (type: LoginType | undefined): boolean =>
	type === 'NIP-07' || type === 'NIP-46' || type === 'nsec';
