<script lang="ts">
	import { IconLoader } from '@tabler/icons-svelte';
</script>

<span class="loading"><IconLoader /></span>

<style>
	.loading {
		display: inline-block;
		width: 24px;
		height: 24px;
		animation: 3s linear infinite rotation;
	}

	@keyframes rotation {
		0% {
			transform: rotate(0);
		}

		100% {
			transform: rotate(360deg);
		}
	}
</style>
