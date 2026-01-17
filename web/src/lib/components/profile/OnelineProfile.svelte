<script lang="ts">
	import ProfileIcon from './ProfileIcon.svelte';
	import ProfileName from './ProfileName.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();
</script>

<ProfileIcon {pubkey} width="1.2rem" height="1.2rem" />
<ProfileName {pubkey} />
