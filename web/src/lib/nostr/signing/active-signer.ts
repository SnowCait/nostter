import type { Signer } from './signer';

let activeSigner: Signer | undefined;

export function setActiveSigner(signer: Signer | undefined): void {
	activeSigner = signer;
}

export function getActiveSigner(): Signer {
	if (activeSigner === undefined) {
		throw new Error('[logic error]');
	}
	return activeSigner;
}

export function clearActiveSigner(): void {
	activeSigner = undefined;
}
