<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import { auth } from '$lib/auth.svelte';
	import {
		loadContentFontSize,
		saveContentFontSize,
		type ContentFontSize
	} from '../application/content-font-size';
	import ContentFontSizePreview from './ContentFontSizePreview.svelte';

	let size = $state<ContentFontSize>(browser ? loadContentFontSize() : 'default');
</script>

<div>
	<label for="content-font-size-select">
		{$_('preferences.content_font_size.content_font_size')}:
	</label>
	<select
		bind:value={
			() => size,
			(value) => {
				size = value;
				saveContentFontSize(value);
			}
		}
		id="content-font-size-select"
	>
		<option value="small">{$_('preferences.content_font_size.small')}</option>
		<option value="default">{$_('preferences.content_font_size.default')}</option>
		<option value="large">{$_('preferences.content_font_size.large')}</option>
		<option value="extra-large">{$_('preferences.content_font_size.extra_large')}</option>
	</select>
	<ContentFontSizePreview pubkey={auth.pubkey} />
</div>
