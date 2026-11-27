/**
 * Namecoin `.bit` NIP-05 resolution surface.
 *
 * Single import point. The `.bit` path is intentionally a drop-in
 * extension of the existing NIP-05 verification: callers ask the same
 * "is this pubkey bound to this identifier?" question, the resolver
 * just routes the lookup over a Namecoin ElectrumX server pool instead
 * of HTTPS when the identifier ends in `.bit` (or starts with `d/` /
 * `id/`). Failures fall back silently — the existing checkmark either
 * shows or it doesn't, no extra UI noise.
 */
export {
	queryProfile,
	isValid,
	isDotBitIdentifier,
	parseIdentifier,
	extractNostrFromValue,
	DEFAULT_ELECTRUMX_SERVERS,
	useWebSocketImplementation,
	type NamecoinResolveResult,
	type ElectrumXServer,
	type ParsedIdentifier
} from './nip05';
