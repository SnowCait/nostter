<script lang="ts">
	import { IconExternalLink } from '@tabler/icons-svelte';

	export let text: string;
	export let url: string = text;
</script>

<a href={url} target="_blank" rel="noopener noreferrer">{text}<IconExternalLink size={15} /></a>
