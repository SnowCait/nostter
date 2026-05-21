<script lang="ts">
	import { Dialog } from 'melt/builders';
	import Img from './Img.svelte';
	import { IconX } from '@tabler/icons-svelte-runes';
	import Swiper from 'swiper';
	import { Navigation, Zoom } from 'swiper/modules';
	import { onMount } from 'svelte';

	interface Props {
		url: URL;
		urls: URL[];
	}

	let { url, urls }: Props = $props();
	const id = $props.id();

	let swiper: Swiper | undefined;
	const dialog = new Dialog({
		closeOnOutsideClick: false,
		onOpenChange: (open) => {
			const index = urls.findIndex((u) => u.href === url.href);
			if (open && swiper !== undefined) {
				swiper.activeIndex = index >= 0 ? index : 0;
			}
		}
	});

	onMount(() => {
		swiper = new Swiper(`.swiper-${id}`, {
			zoom: true,
			modules: [Navigation, Zoom],
			navigation: {
				nextEl: '.swiper-button-next',
				prevEl: '.swiper-button-prev'
			}
		});
	});

	function close(e: MouseEvent): void {
		const target = e.target as HTMLElement;
		if (
			target.closest('img') ||
			target.closest('.swiper-button-prev') ||
			target.closest('.swiper-button-next')
		) {
			return;
		}
		dialog.open = false;
	}
</script>

<button class="clear" {...dialog.trigger}>
	<Img {url} />
</button>

<dialog {...dialog.content} onclick={close} class="media-dialog" autofocus>
	<div class="swiper swiper-{id}">
		<div class="swiper-wrapper">
			{#each urls as url}
				<div class="swiper-slide">
					<div class="swiper-zoom-container">
						<img src={url.href} alt={url.href} class:single={urls.length === 1} />
					</div>
				</div>
			{/each}
		</div>
		<div class="swiper-button-prev"></div>
		<div class="swiper-button-next"></div>
	</div>
	<button class="close" onclick={close}>
		<IconX size="2rem" />
	</button>
</dialog>

<style>
	dialog {
		--close-button-size: 3rem;
		--close-button-offset: 0.5rem;
		--viewer-safe-top: env(safe-area-inset-top, 0px);
		--viewer-safe-right: env(safe-area-inset-right, 0px);
		width: 100dvw;
		height: 100dvh;
	}

	.swiper,
	.swiper-wrapper,
	.swiper-slide,
	.swiper-zoom-container {
		width: 100%;
		height: 100%;
	}

	button.close {
		position: fixed;
		top: calc(var(--viewer-safe-top) + var(--close-button-offset));
		right: calc(var(--viewer-safe-right) + var(--close-button-offset));
		z-index: 2;
		background: rgb(0 0 0 / 0.45);
		border: none;
		border-radius: calc(infinity * 1px);
		color: white;
		font-size: 2em;
		cursor: pointer;
		padding: 0.5rem;
		width: var(--close-button-size);
		height: var(--close-button-size);
	}

	img {
		max-width: calc(100vw - 128px);
		max-height: 100dvh;
		margin: auto;
		display: block;
		color: white;
		object-fit: contain;
	}

	img.single {
		max-width: 100vw;
	}
</style>
