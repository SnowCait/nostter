<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { browser } from '$app/environment';
	import {
		loadContentFontSize,
		saveContentFontSize,
		type ContentFontSize
	} from '../application/content-font-size';

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
	<div class="preview" aria-hidden="true">
		<div class="user">
			<span class="display-name">Alice</span>
			<span class="name">@alice</span>
			<span class="created-at">12:34</span>
		</div>
		<p class="body">{$_('preferences.content_font_size.preview')}</p>
	</div>
</div>

<style>
	.preview {
		margin-top: 0.5rem;
		padding: 0.75rem 1rem;
		border: var(--default-border);
		border-radius: var(--radius);
		background-color: var(--surface);
		color: var(--surface-foreground);
	}

	.user {
		display: flex;
		gap: 0.3rem;
		min-width: 0;
		font-size: calc(15px * var(--content-font-scale));
	}

	.display-name {
		font-weight: 700;
	}

	.name {
		color: var(--accent-gray);
	}

	.display-name,
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.created-at {
		margin-left: auto;
		flex-shrink: 0;
		color: var(--accent-gray);
		font-size: calc(0.7rem * var(--content-font-scale));
	}

	.body {
		margin: 0.2rem 0 0;
		font-size: calc(15px * var(--content-font-scale));
		overflow-wrap: anywhere;
	}
</style>
