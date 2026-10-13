import ipaddr from 'ipaddr.js';

export function isRelayUrl(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}

	try {
		const { protocol } = new URL(value);
		return protocol === 'ws:' || protocol === 'wss:';
	} catch {
		return false;
	}
}

export function isSecureRelayUrl(value: unknown): value is string {
	return typeof value === 'string' && URL.parse(value)?.protocol === 'wss:';
}

// IANA Special-Purpose Address Registries: globally reachable exceptions take precedence.
// https://www.iana.org/assignments/iana-ipv4-special-registry/
// https://www.iana.org/assignments/iana-ipv6-special-registry/
const nonPublicIpv4 = [
	'0.0.0.0/8',
	'10.0.0.0/8',
	'100.64.0.0/10',
	'127.0.0.0/8',
	'169.254.0.0/16',
	'172.16.0.0/12',
	'192.0.0.0/24',
	'192.0.2.0/24',
	'192.88.99.0/24',
	'192.168.0.0/16',
	'198.18.0.0/15',
	'198.51.100.0/24',
	'203.0.113.0/24',
	'224.0.0.0/4',
	'240.0.0.0/4'
].map((cidr) => ipaddr.IPv4.parseCIDR(cidr));
const publicIpv4Exceptions = ['192.0.0.9/32', '192.0.0.10/32'].map((cidr) =>
	ipaddr.IPv4.parseCIDR(cidr)
);
const nonPublicIpv6 = [
	'2001::/23',
	'2001:db8::/32',
	'2002::/16',
	'2d00::/8',
	'2e00::/7',
	'3000::/4'
].map((cidr) => ipaddr.IPv6.parseCIDR(cidr));
const publicIpv6Exceptions = [
	'2001:1::1/128',
	'2001:1::2/128',
	'2001:1::3/128',
	'2001:3::/32',
	'2001:4:112::/48',
	'2001:20::/28',
	'2001:30::/28'
].map((cidr) => ipaddr.IPv6.parseCIDR(cidr));
// https://www.iana.org/assignments/ipv6-unicast-address-assignments/
const globalIpv6 = ipaddr.IPv6.parseCIDR('2000::/3');
const translatedIpv6 = ipaddr.IPv6.parseCIDR('64:ff9b::/96');

function isPublicIpv4(address: ipaddr.IPv4): boolean {
	return (
		publicIpv4Exceptions.some((cidr) => address.match(cidr)) ||
		!nonPublicIpv4.some((cidr) => address.match(cidr))
	);
}

export function isPublicRelayUrl(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}
	try {
		const url = new URL(value);
		if (
			(url.protocol !== 'ws:' && url.protocol !== 'wss:') ||
			url.username ||
			url.password ||
			url.hash
		) {
			return false;
		}
		const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
		if (
			['localhost', 'local'].some(
				(name) => hostname === name || hostname.endsWith(`.${name}`)
			)
		) {
			return false;
		}
		// URL canonicalization resolves alternate IPv4 spellings before IP classification.
		const host = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
		if (!ipaddr.isValid(host)) {
			return true;
		}
		const address = ipaddr.parse(host);
		if (address instanceof ipaddr.IPv4) {
			return isPublicIpv4(address);
		}
		if (address.isIPv4MappedAddress()) {
			return isPublicIpv4(address.toIPv4Address());
		}
		if (address.match(translatedIpv6)) {
			return isPublicIpv4(new ipaddr.IPv4(address.toByteArray().slice(-4)));
		}
		// Other IPv6 space is reserved, local, or multicast. Transition ranges with
		// conditional reachability are excluded; specific IANA global allocations are allowed.
		return (
			publicIpv6Exceptions.some((cidr) => address.match(cidr)) ||
			(address.match(globalIpv6) && !nonPublicIpv6.some((cidr) => address.match(cidr)))
		);
	} catch {
		return false;
	}
}
