<script lang="ts">
	import { Kind, nip19 } from 'nostr-tools';
	import { _ } from 'svelte-i18n';
	import Cropper from 'svelte-easy-crop';
	import { goto } from '$app/navigation';
	import { FileStorageServer } from '$lib/media/FileStorageServer';
	import { getMediaUploader } from '$lib/media/Media';
	import { appName } from '$lib/Constants';
	import { Api } from '$lib/Api';
	import { pubkey, author, authorProfile, metadataEvent, writeRelays } from '$lib/stores/Author';
	import { pool } from '$lib/stores/Pool';
	import MediaPicker from '$lib/components/MediaPicker.svelte';
	import ModalDialog from '$lib/components/ModalDialog.svelte';

	//#region Cropper

	type Pixels = { height: number; width: number; x: number; y: number };

	let open = false;
	let url = '';
	let pixels: Pixels | undefined;
	let complete: (value: File | PromiseLike<File | undefined> | undefined) => void;

	async function crop(file: File): Promise<File | undefined> {
		console.debug('[profile picture crop]', file);
		return new Promise((resolve) => {
			complete = resolve;
			const reader = new FileReader();
			reader.addEventListener('load', () => {
				console.debug('[profile picture data url]', reader.result);
				if (typeof reader.result === 'string') {
					url = reader.result;
					open = true;
				}
			});
			reader.readAsDataURL(file);
		});
	}

	function onCropComplete({ detail }: { detail: { pixels: Pixels } }): void {
		pixels = detail.pixels;
	}

	function applyCrop() {
		console.debug('[profile picture apply]', pixels);
		const image = new Image();
		image.addEventListener('load', () => {
			console.debug('[profile picture apply load]', image);
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			if (ctx === null || pixels === undefined) {
				complete(undefined);
				return;
			}
			canvas.width = image.width;
			canvas.height = image.height;
			ctx.drawImage(image, 0, 0);
			const data = ctx.getImageData(pixels.x, pixels.y, pixels.width, pixels.height);
			canvas.width = pixels.width;
			canvas.height = pixels.height;
			ctx.putImageData(data, 0, 0);
			ctx.canvas.toBlob((file) => {
				complete(file as File);
				open = false;
			});
		});
		image.src = url;
	}

	function close(): void {
		console.debug('[profile picture crop close]');
		complete(undefined);
		url = '';
		pixels = undefined;
	}

	//#endregion

	async function picturePicked({ detail: files }: { detail: FileList }): Promise<void> {
		console.log('[profile picture]', files);
		if (files.length !== 1) {
			console.error('[profile picture error]', files);
		}

		const file = files[0];
		const croppedFile = await crop(file);
		if (croppedFile === undefined) {
			// Cancelled
			return;
		}

		console.debug('[profile picture cropped file]', croppedFile);

		try {
			const media = new FileStorageServer(getMediaUploader());
			const { url } = await media.upload(croppedFile);
			if (url) {
				$authorProfile.picture = url;
			}
		} catch (error) {
			console.error('[media upload error]', error);
			alert($_('media.upload.failed'));
		}
	}

	async function bannerPicked({ detail: files }: { detail: FileList }): Promise<void> {
		console.log('[profile banner]', files);
		if (files.length !== 1) {
			console.error('[profile banner error]', files);
		}

		const file = files[0];
		try {
			const media = new FileStorageServer(getMediaUploader());
			const { url } = await media.upload(file);
			if (url) {
				$authorProfile.banner = url;
			}
		} catch (error) {
			console.error('[media upload error]', error);
			alert($_('media.upload.failed'));
		}
	}

	async function save(): Promise<void> {
		console.log('[save metadata]', $authorProfile);

		if ($authorProfile === undefined) {
			console.error('[save failed]');
			return;
		}

		const api = new Api($pool, $writeRelays);
		try {
			await api.signAndPublish(
				Kind.Metadata,
				JSON.stringify($authorProfile),
				$metadataEvent?.tags ?? []
			);
			await goto(`/${nip19.npubEncode($pubkey)}`);
		} catch (error) {
			console.error('[save metadata failed]', error);
			alert('Failed to update profile.');
		}
	}
</script>

<svelte:head>
	<title>{appName} - {$_('pages.profile_edit')}</title>
</svelte:head>

<h1>{$_('pages.profile_edit')}</h1>

<ModalDialog bind:open on:close={close}>
	<div class="crop">
		<Cropper image={url} aspect={1} maxZoom={10} on:cropcomplete={onCropComplete} />
	</div>

	<form class="apply" on:submit|preventDefault={applyCrop}>
		<input type="submit" value={$_('media.upload.apply')} />
	</form>
</ModalDialog>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<form class="card" on:submit|preventDefault={save} on:keyup|stopPropagation={console.debug}>
	<div class="picture">
		<label for="picture">Picture</label>
		<div>
			<input
				type="url"
				id="picture"
				placeholder="https://example.com/picture.png"
				bind:value={$authorProfile.picture}
			/>
			<MediaPicker on:pick={picturePicked} />
		</div>
		{#if $authorProfile.picture}
			<img src={$authorProfile.picture} alt="preview" />
		{/if}
	</div>
	<div class="banner">
		<label for="banner">Banner</label>
		<div>
			<input
				type="url"
				id="banner"
				placeholder="https://example.com/banner.webp"
				bind:value={$authorProfile.banner}
			/>
			<MediaPicker on:pick={bannerPicked} />
		</div>
		{#if $authorProfile.banner}
			<img src={$authorProfile.banner} alt="preview" />
		{/if}
	</div>
	<div class="name">
		<label for="name">@name</label>
		<input type="text" id="name" placeholder="name" bind:value={$authorProfile.name} />
	</div>
	<div class="display-name">
		<label for="display-name">Display name</label>
		<input
			type="text"
			id="display-name"
			placeholder="Display Name"
			bind:value={$authorProfile.display_name}
		/>
	</div>
	<div class="nip05">
		<label for="nip05">Nostr Address</label>
		<input
			type="text"
			id="nip05"
			placeholder="name@example.com"
			bind:value={$authorProfile.nip05}
		/>
	</div>
	<div class="website">
		<label for="website">Website</label>
		<input
			type="url"
			id="website"
			placeholder="https://example.com"
			bind:value={$authorProfile.website}
		/>
	</div>
	<div class="lud16">
		<label for="lud16">Lightning Address</label>
		<input
			type="email"
			id="lud16"
			placeholder="satoshi@bitcoin.org"
			bind:value={$authorProfile.lud16}
		/>
	</div>
	<div class="about">
		<label for="about">about</label>
		<textarea id="about" bind:value={$authorProfile.about} />
	</div>
	{#if $author}
		<div>
			<input type="submit" value="Save" />
		</div>
	{/if}
</form>

<style>
	div {
		margin-bottom: 1rem;
	}

	input[type='url'],
	input[type='email'],
	input[type='text'],
	textarea {
		width: 100%;
	}

	.picture div,
	.banner div {
		display: flex;
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.picture input,
	.banner input {
		width: calc(100% - 50px);
		margin-right: 10px;
	}

	textarea {
		height: 20rem;
		border: var(--default-border);
	}

	img {
		max-width: 100%;
		max-height: 10rem;
	}

	.crop {
		position: relative;
		width: 300px;
		height: 300px;
	}

	.apply {
		text-align: center;
	}
</style>
