<script lang="ts">
	import type { ChannelMetadata } from '$lib/Types';

	interface Props {
		channelMetadata: ChannelMetadata | undefined;
	}

	let { channelMetadata }: Props = $props();
</script>

<div>
	<img src={channelMetadata?.picture} alt="" />
	<span>{channelMetadata?.name ?? ''}</span>
</div>

<style>
	div {
		display: flex;
		align-items: center;
	}

	img {
		width: 3rem;
		height: 3rem;
		object-fit: cover;
	}

	span {
		color: var(--foreground);
		font-size: 1.5rem;
		margin-left: 1rem;
	}
</style>
