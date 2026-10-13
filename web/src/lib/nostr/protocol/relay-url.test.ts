import { describe, expect, it } from 'vitest';
import { isPublicRelayUrl, isRelayUrl, isSecureRelayUrl } from './relay-url';

describe('isRelayUrl', () => {
	it('accepts wss: URLs', () => {
		expect(isRelayUrl('wss://relay.example.com')).toBe(true);
	});

	it('accepts ws: URLs', () => {
		expect(isRelayUrl('ws://localhost:8080')).toBe(true);
	});

	it('rejects https: URLs', () => {
		expect(isRelayUrl('https://example.com')).toBe(false);
	});

	it('rejects malformed URLs', () => {
		expect(isRelayUrl('not-a-url')).toBe(false);
	});

	it('rejects non-string values', () => {
		expect(isRelayUrl(undefined)).toBe(false);
	});
});

describe('isSecureRelayUrl', () => {
	it('accepts wss: URLs', () => {
		expect(isSecureRelayUrl('wss://relay.example.com')).toBe(true);
	});

	it('rejects ws: URLs', () => {
		expect(isSecureRelayUrl('ws://relay.example.com')).toBe(false);
	});

	it('rejects other schemes', () => {
		expect(isSecureRelayUrl('https://relay.example.com')).toBe(false);
		expect(isSecureRelayUrl('http://relay.example.com')).toBe(false);
	});

	it('rejects malformed URLs and non-string values', () => {
		expect(isSecureRelayUrl('wss://')).toBe(false);
		expect(isSecureRelayUrl('relay.example.com')).toBe(false);
		expect(isSecureRelayUrl(undefined)).toBe(false);
	});
});

describe('isPublicRelayUrl', () => {
	it.each([
		'wss://8.8.8.8/',
		'ws://1.1.1.1:8080/',
		'wss://[2606:4700:4700::1111]/',
		'wss://relay.example.com/',
		'wss://LOCALHOST.example.com/',
		'wss://192.0.0.9/',
		'wss://192.0.0.10/',
		'wss://192.31.196.1/',
		'wss://192.52.193.1/',
		'wss://192.175.48.1/',
		'wss://172.15.255.255/',
		'wss://172.32.0.1/',
		'wss://100.63.255.255/',
		'wss://100.128.0.1/',
		'wss://[::ffff:8.8.8.8]/',
		'wss://[64:ff9b::808:808]/',
		'wss://[2001:1::1]/',
		'wss://[2001:1::2]/',
		'wss://[2001:1::3]/',
		'wss://[2001:3::1]/',
		'wss://[2001:4:112::1]/',
		'wss://[2001:20::1]/',
		'wss://[2001:30::1]/',
		'wss://[2620:4f:8000::1]/'
	])('allows public relay %s, including IANA global exceptions', (url) => {
		expect(isPublicRelayUrl(url)).toBe(true);
	});

	it.each([
		'wss://10.0.0.1/',
		'wss://172.16.0.1/',
		'wss://172.31.255.255/',
		'wss://192.168.1.1/',
		'wss://127.0.0.1/',
		'wss://169.254.1.1/',
		'wss://100.64.0.1/',
		'wss://100.127.255.255/',
		'wss://0.0.0.0/',
		'wss://0.1.2.3/',
		'wss://224.0.0.1/',
		'wss://255.255.255.255/',
		'wss://240.0.0.1/',
		'wss://192.0.0.8/',
		'wss://192.0.0.11/',
		'wss://192.0.0.170/',
		'wss://192.0.2.1/',
		'wss://198.51.100.1/',
		'wss://203.0.113.1/',
		'wss://198.18.0.1/',
		'wss://192.88.99.2/',
		'wss://[::]/',
		'wss://[::1]/',
		'wss://[fe80::1]/',
		'wss://[fc00::1]/',
		'wss://[fd00::1]/',
		'wss://[ff02::1]/',
		'wss://[fec0::1]/',
		'wss://[2001:db8::1]/',
		'wss://[3fff::1]/',
		'wss://[3ffe::1]/',
		'wss://[3000::1]/',
		'wss://[2d00::1]/',
		'wss://[5f00::1]/',
		'wss://[100::1]/',
		'wss://[100:0:0:1::1]/',
		'wss://[64:ff9b:1::1]/',
		'wss://[2001:2::1]/',
		'wss://[2001::1]/',
		'wss://[2002::1]/',
		'wss://[2001:1::4]/',
		'wss://[::ffff:127.0.0.1]/',
		'wss://[::ffff:c0a8:101]/',
		'wss://[64:ff9b::7f00:1]/',
		'wss://localhost/',
		'wss://LOCALHOST./',
		'wss://relay.localhost/',
		'wss://relay.local./',
		'wss://local/',
		'wss://127.1/',
		'wss://127.0.1/',
		'wss://2130706433/',
		'wss://0x7f000001/',
		'wss://0177.0.0.1/',
		'wss://%31%32%37.0.0.1/'
	])('rejects non-public relay %s', (url) => {
		expect(isPublicRelayUrl(url)).toBe(false);
	});

	it.each([
		undefined,
		null,
		{},
		'',
		'wss://',
		'not-a-url',
		'https://8.8.8.8/',
		'wss://[:::1]/',
		'wss://127.0.0.999/',
		'wss://relay.example.com:-1/',
		'wss://user:password@relay.example.com/',
		'wss://relay.example.com/#fragment'
	])('rejects invalid WebSocket URL %s', (url) => {
		expect(isPublicRelayUrl(url)).toBe(false);
	});

	it.each(['ws://127.0.0.1/', 'wss://[::1]/', 'ws://relay.local/'])(
		'keeps configured local relay %s valid under the existing policy',
		(url) => {
			expect(isRelayUrl(url)).toBe(true);
			expect(isPublicRelayUrl(url)).toBe(false);
		}
	);
});
