import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from 'nostr-tools';
import { Contacts, RelayList } from 'nostr-tools/kinds';
import type { EventPacket } from 'rx-nostr';
import { EMPTY, lastValueFrom, Subject, throwError, toArray } from 'rxjs';
import { rxNostr } from '$lib/relay-client';
import { Api } from './Api';

const pubkey = 'a'.repeat(64);

function event(kind: number, created_at: number): Event {
	return {
		id: `${kind}-${created_at}`.padStart(64, '0'),
		pubkey,
		kind,
		created_at,
		tags: [],
		content: '',
		sig: ''
	};
}

afterEach(() => vi.restoreAllMocks());

describe('Api.fetchRelayEvents', () => {
	it('passes the relay scope through and keeps the latest event per kind after completion', async () => {
		const packets = new Subject<EventPacket>();
		const use = vi.spyOn(rxNostr, 'use').mockReturnValue(packets);
		const relays = ['wss://relay.example.com'];
		const on = { relays, defaultReadRelays: true, defaultWriteRelays: false };
		const latestContacts = event(Contacts, 3);
		const latestRelayList = event(RelayList, 4);
		const resolved = vi.fn();
		const result = new Api().fetchRelayEvents(pubkey, on).then((events) => {
			resolved();
			return events;
		});

		expect(use).toHaveBeenCalledOnce();
		const [req, options] = use.mock.calls[0];
		expect(req.strategy).toBe('backward');
		expect(options).toEqual({ on });
		await expect(lastValueFrom(req.getReqPacketObservable().pipe(toArray()))).resolves.toEqual([
			{ filters: [{ kinds: [Contacts, RelayList], authors: [pubkey] }] }
		]);

		for (const received of [
			latestContacts,
			latestRelayList,
			event(Contacts, 1),
			event(RelayList, 2)
		]) {
			packets.next({ event: received, from: relays[0] } as EventPacket);
		}
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(resolved).not.toHaveBeenCalled();
		packets.complete();

		await expect(result).resolves.toEqual(
			new Map([
				[Contacts, latestContacts],
				[RelayList, latestRelayList]
			])
		);
	});

	it('passes a default write scope with no additional relays and returns an empty Map on completion', async () => {
		const use = vi.spyOn(rxNostr, 'use').mockReturnValue(EMPTY);
		const on = { relays: [], defaultWriteRelays: true, defaultReadRelays: false };

		await expect(new Api().fetchRelayEvents(pubkey, on)).resolves.toEqual(new Map());
		expect(use.mock.calls[0][1]).toEqual({ on });
	});

	it('propagates unexpected request errors', async () => {
		const error = new Error('Unexpected request failure');
		vi.spyOn(rxNostr, 'use').mockReturnValue(throwError(() => error));

		await expect(new Api().fetchRelayEvents(pubkey, { defaultReadRelays: true })).rejects.toBe(
			error
		);
	});
});
