<script lang="ts">
	import { Kind, nip19 } from 'nostr-tools';
	import { Signer } from '$lib/Signer';
	import { Api } from '$lib/Api';
	import { pubkey, author, authorProfile, metadataEvent, writeRelays } from '../../stores/Author';
	import { pool } from '../../stores/Pool';
	import { goto } from '$app/navigation';

	async function save() {
		console.log('[save metadata]', $authorProfile);

		if ($authorProfile === undefined) {
			console.error('[save failed]');
			return;
		}

		const event = await Signer.signEvent({
			created_at: Math.floor(Date.now() / 1000),
			kind: Kind.Metadata,
			tags: $metadataEvent?.tags ?? [],
			content: JSON.stringify($authorProfile)
		});
		console.log('[metadata event]', event);
		const api = new Api($pool, $writeRelays);
		const success = await api.publish(event);
		if (success) {
			await goto(`/${nip19.npubEncode($pubkey)}`);
		} else {
			alert('Failed to update profile.');
		}
	}
</script>

<h1>Edit profile</h1>

<form on:submit|preventDefault={save} on:keyup|stopPropagation={() => console.debug}>
	<div class="picture">
		<label for="picture">Picture</label>
		<input
			type="url"
			id="picture"
			placeholder="https://example.com/picture.png"
			bind:value={$authorProfile.picture}
		/>
		{#if $authorProfile.picture}
			<img src={$authorProfile.picture} alt="preview" />
		{/if}
	</div>
	<div class="banner">
		<label for="banner">Banner</label>
		<input
			type="url"
			id="banner"
			placeholder="https://example.com/banner.webp"
			bind:value={$authorProfile.banner}
		/>
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
		<label for="nip05">NIP-05</label>
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
		margin: 1rem 0;
	}

	input[type='url'],
	input[type='email'],
	input[type='text'],
	textarea {
		width: 100%;
	}

	textarea {
		height: 10rem;
	}

	input[type='submit'] {
		height: 2rem;
		margin-bottom: 2rem;
	}

	img {
		max-height: 10rem;
	}
</style>
