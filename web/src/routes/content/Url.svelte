<script lang="ts">
	import { IconExternalLink } from '@tabler/icons-svelte';

	export let text: string;
</script>

<a href={text} target="_blank" rel="noopener noreferrer">{text}<IconExternalLink size={15} /></a>
