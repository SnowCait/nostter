<script lang="ts">
	export let text: string;
</script>

<a href="/search?q={encodeURIComponent(`${text}`)}">{text}</a>
