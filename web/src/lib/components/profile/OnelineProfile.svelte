<script lang="ts">
	import ProfileIcon from './ProfileIcon.svelte';
	import ProfileName from './ProfileName.svelte';

	export let pubkey: string;
</script>

<ProfileIcon {pubkey} width="1.2rem" height="1.2rem" size="s" />
<ProfileName {pubkey} />
