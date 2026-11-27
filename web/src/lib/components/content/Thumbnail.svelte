<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { _ } from 'svelte-i18n';
	import Img from './Img.svelte';
	import { IconX } from '@tabler/icons-svelte-runes';
	import Swiper from 'swiper';
	import { Navigation, Zoom } from 'swiper/modules';
	import { onDestroy } from 'svelte';

	interface Props {
		url: URL;
		urls: URL[];
	}

	let { url, urls }: Props = $props();
	const id = $props.id();

	let swiper: Swiper | undefined;
	let open = $state(false);
	function opened(isOpen: boolean): void {
		if (!isOpen) {
			return;
		}
		if (swiper === undefined) {
			swiper = new Swiper(`.swiper-${id}`, {
				zoom: true,
				modules: [Navigation, Zoom],
				navigation: {
					nextEl: '.swiper-button-next',
					prevEl: '.swiper-button-prev'
				}
			});
		}
		const index = urls.findIndex((u) => u.href === url.href);
		swiper.slideTo(index >= 0 ? index : 0, 0);
	}

	onDestroy(() => swiper?.destroy());

	function close(e: MouseEvent): void {
		const target = e.target as HTMLElement;
		if (
			target.closest('img') ||
			target.closest('.swiper-button-prev') ||
			target.closest('.swiper-button-next')
		) {
			return;
		}
		open = false;
	}
</script>

<Dialog.Root bind:open onOpenChangeComplete={opened}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<button {...props} class="clear" aria-label={url.href}>
				<Img {url} />
			</button>
		{/snippet}
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay class="media-viewer-overlay" />
		<Dialog.Content
			forceMount
			onclick={close}
			onInteractOutside={(event) => event.preventDefault()}
		>
			{#snippet child({ props })}
				<div {...props} class="media-dialog" hidden={!open}>
					<Dialog.Title class="media-viewer-a11y">{$_('media.title')}</Dialog.Title>
					<button class="close" onclick={close} aria-label={$_('editor.close.button')}>
						<IconX size="2rem" />
					</button>
					<div class="swiper swiper-{id}">
						<div class="swiper-wrapper">
							{#each urls as url}
								<div class="swiper-slide">
									<div class="swiper-zoom-container">
										<img
											src={url.href}
											alt={url.href}
											class:single={urls.length === 1}
											loading="lazy"
											decoding="async"
										/>
									</div>
								</div>
							{/each}
						</div>
						<button
							type="button"
							class="swiper-button-prev"
							aria-label={$_('media.previous_image')}
						></button>
						<button
							type="button"
							class="swiper-button-next"
							aria-label={$_('media.next_image')}
						></button>
					</div>
				</div>
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	:global(.media-viewer-overlay) {
		position: fixed;
		inset: 0;
		z-index: 2000;
		background: rgb(0 0 0 / 90%);
		cursor: default;
	}
	:global(.media-viewer-a11y) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.media-dialog {
		position: fixed;
		inset: 0;
		z-index: 2001;
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		outline: none;
		cursor: default;
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

	.swiper-button-prev,
	.swiper-button-next {
		background: none;
		border: none;
		padding: 0;
	}

	.swiper-button-prev:hover,
	.swiper-button-next:hover {
		opacity: 1;
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
		max-width: 100%;
	}
</style>
