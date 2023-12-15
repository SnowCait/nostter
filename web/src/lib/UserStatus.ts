import { get } from 'svelte/store';
import { batch, createRxForwardReq, latestEach, uniq } from 'rx-nostr';
import { bufferTime } from 'rxjs';
import { rxNostr } from './timelines/MainTimeline';
import { userStatusesGeneral, userStatusesMusic } from '../stores/UserStatuses';

export const userStatusReq = createRxForwardReq();
rxNostr
	.use(userStatusReq.pipe(bufferTime(1000), batch()))
	.pipe(
		uniq(),
		latestEach((packet) => packet.event.pubkey)
	)
	.subscribe((packet) => {
		console.log('[user status]', packet, packet.event.pubkey, packet.event.content);
		const tags: string[][] = packet.event.tags;
		const expiration = tags.find(([tagName]) => tagName === 'expiration')?.at(1);
		if (expiration !== undefined && Number(expiration) < Math.floor(Date.now() / 1000)) {
			return;
		}
		const identifier = tags.find(([tagName]) => tagName === 'd')?.at(1) ?? '';
		switch (identifier) {
			case 'general': {
				const $userStatusesGeneral = get(userStatusesGeneral);
				$userStatusesGeneral.push(packet.event);
				userStatusesGeneral.set($userStatusesGeneral);
				break;
			}
			case 'music': {
				const $userStatusesMusic = get(userStatusesMusic);
				$userStatusesMusic.push(packet.event);
				userStatusesMusic.set($userStatusesMusic);
				break;
			}
		}
	});
