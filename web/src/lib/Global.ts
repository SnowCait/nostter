import { createRxNostr } from 'rx-nostr';

export const timeout = 3400;
export const rxNostr = createRxNostr({ timeout }); // for home & notification timeline
