import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import ZapDialog from './ZapDialog.svelte';
import type { Signer } from '$lib/nostr/signing/signer';
const signedEvent = {
	id: '',
	sig: '',
	kind: 9734,
	created_at: 0,
	pubkey: 'a'.repeat(64),
	tags: [],
	content: ''
};
const mocks = vi.hoisted(() => ({ pay: vi.fn(), zapUrl: vi.fn() }));
vi.mock('$lib/Zap', () => ({ zapWithWalletConnect: mocks.pay }));
vi.mock('$lib/relay-client', () => ({ rxNostr: { getDefaultRelays: () => ({}) } }));
vi.mock('$lib/Items', () => ({ EventItem: class {} }));
vi.mock('./items/EventComponent.svelte', () => ({ default: () => {} }));
vi.mock('./profile/ProfileIcon.svelte', () => ({ default: () => {} }));
vi.mock('./profile/ProfileName.svelte', () => ({ default: () => {} }));
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,' } }));
vi.mock('svelte-i18n', () => ({ _: writable((key: string) => key) }));
vi.mock('$lib/platform/storage/persisted-store', () => ({ persistedStore: () => writable([21]) }));
vi.mock('$lib/cache/Events', () => ({
	metadataStore: writable(new Map([['a'.repeat(64), { zapUrl: mocks.zapUrl }]]))
}));
let component: ZapDialog;
let target: HTMLDivElement;
let sign: Mock<Signer['signEvent']>;
let feedback: Mock<() => void>;
const submit = () =>
	target.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
const reopen = () => {
	target.querySelector('dialog')!.dispatchEvent(new Event('close'));
	flushSync();
	component.openZapDialog();
	flushSync();
};
async function finish() {
	await vi.waitFor(() =>
		expect(target.querySelector('input[type="submit"]')?.hasAttribute('disabled')).toBe(false)
	);
}
beforeEach(() => {
	vi.resetAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
	mocks.pay.mockResolvedValue(false);
	localStorage.clear();
	vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => {});
	vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(() => {});
	mocks.zapUrl.mockResolvedValue(new URL('https://wallet.example/invoice'));
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pr: 'invoice' }) })
	);
	sign = vi.fn<Signer['signEvent']>().mockResolvedValue(signedEvent);
	feedback = vi.fn();
	target = document.createElement('div');
	document.body.append(target);
	component = mount(ZapDialog, {
		target,
		props: { pubkey: 'a'.repeat(64), signEvent: sign, onZapped: feedback }
	});
	component.openZapDialog();
	flushSync();
});
afterEach(async () => {
	await unmount(component);
	target.remove();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
it('resets the invoice and comment to a fresh form with the latest amount', async () => {
	const amount = target.querySelector<HTMLInputElement>('input[type="number"]')!;
	amount.value = '42';
	amount.dispatchEvent(new Event('input'));
	const comment = target.querySelector('textarea')!;
	comment.value = 'hello';
	comment.dispatchEvent(new Event('input'));
	submit();
	await vi.waitFor(() => expect(target.querySelector('.lnbc')).not.toBeNull());
	expect(feedback).toHaveBeenCalledOnce();
	reopen();
	expect(target.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe('42');
	expect(target.querySelector('textarea')!.value).toBe('');
	expect(target.querySelector('.lnbc')).toBeNull();
});
it.each(['success', 'failure'])(
	'ignores an old invoice %s after reopening and allows retry on completion',
	async (outcome) => {
		localStorage.setItem('nostter:nostr-wallet-connect', 'wallet');
		const response = Promise.withResolvers<Response>();
		vi.mocked(fetch).mockReturnValueOnce(response.promise);
		submit();
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		reopen();
		submit();
		expect(sign).toHaveBeenCalledOnce();
		if (outcome === 'success') {
			response.resolve(new Response(JSON.stringify({ pr: 'old' })));
		} else {
			response.reject(new Error('offline'));
		}
		await finish();
		expect(target.querySelector('.lnbc')).toBeNull();
		expect(target.querySelector('[role="alert"]')).toBeNull();
		expect(mocks.pay).not.toHaveBeenCalled();
		expect(feedback).not.toHaveBeenCalled();
		submit();
		await vi.waitFor(() => expect(feedback).toHaveBeenCalledOnce());
	}
);
it('stops an old signing operation before invoice retrieval', async () => {
	const signed = Promise.withResolvers<Awaited<ReturnType<Signer['signEvent']>>>();
	sign.mockReturnValueOnce(signed.promise);
	submit();
	reopen();
	signed.resolve(signedEvent);
	await finish();
	expect(fetch).not.toHaveBeenCalled();
	expect(mocks.pay).not.toHaveBeenCalled();
});
it.each([true, false])(
	'finishes an existing NWC payment (%s) without changing the reopened form',
	async (success) => {
		localStorage.setItem('nostter:nostr-wallet-connect', 'wallet');
		const payment = Promise.withResolvers<boolean>();
		mocks.pay.mockReturnValueOnce(payment.promise);
		submit();
		await vi.waitFor(() => expect(mocks.pay).toHaveBeenCalledOnce());
		reopen();
		submit();
		expect(sign).toHaveBeenCalledOnce();
		vi.mocked(HTMLDialogElement.prototype.close).mockClear();
		payment.resolve(success);
		await finish();
		expect(target.querySelector('.lnbc')).toBeNull();
		expect(target.querySelector('form')).not.toBeNull();
		expect(feedback).toHaveBeenCalledTimes(success ? 1 : 0);
		expect(HTMLDialogElement.prototype.close).not.toHaveBeenCalled();
	}
);
it('clears a previous error on reopening', async () => {
	sign.mockRejectedValueOnce(new Error('sign failed'));
	submit();
	await vi.waitFor(() => expect(target.querySelector('[role="alert"]')).not.toBeNull());
	reopen();
	expect(target.querySelector('[role="alert"]')).toBeNull();
});
