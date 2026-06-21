<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
	import { EditorState, Prec } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
	import { metadataStore } from '$lib/cache/Events';
	import { editorDecorations, setTagsEffect, refreshEffect } from './editorDecorations';

	interface Props {
		value?: string;
		tags?: string[][];
		placeholder?: string;
		oninput?: () => void;
		onkeydown?: (event: KeyboardEvent) => void;
		onpaste?: (event: ClipboardEvent) => void;
		ondrop?: (event: DragEvent) => void;
		ondragover?: (event: DragEvent) => void;
	}

	let {
		value = $bindable(''),
		tags = [],
		placeholder = '',
		oninput,
		onkeydown,
		onpaste,
		ondrop,
		ondragover
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	let view: EditorView | undefined;
	let applyingExternal = false;

	export function focus(): void {
		view?.focus();
	}

	export function getSelection(): { from: number; to: number } {
		const selection = view?.state.selection.main;
		return { from: selection?.from ?? 0, to: selection?.to ?? 0 };
	}

	export function setSelection(from: number, to: number = from): void {
		if (view === undefined) {
			return;
		}
		const length = view.state.doc.length;
		view.dispatch({
			selection: { anchor: Math.min(from, length), head: Math.min(to, length) }
		});
	}

	export function getCursorCoords(): { left: number; top: number; bottom: number } | undefined {
		if (view === undefined) {
			return undefined;
		}
		return view.coordsAtPos(view.state.selection.main.head) ?? undefined;
	}

	onMount(() => {
		const editorView = new EditorView({
			parent: container,
			state: EditorState.create({
				doc: value,
				extensions: [
					history(),
					EditorView.lineWrapping,
					placeholderExtension(placeholder),
					editorDecorations,
					keymap.of([...defaultKeymap, ...historyKeymap]),
					EditorView.updateListener.of((update) => {
						if (update.docChanged && !applyingExternal) {
							value = update.state.doc.toString();
							oninput?.();
						}
					}),
					Prec.highest(
						EditorView.domEventHandlers({
							keydown: (event) => {
								onkeydown?.(event);
								return event.defaultPrevented;
							},
							paste: (event) => {
								onpaste?.(event);
								return event.defaultPrevented;
							},
							drop: (event) => {
								ondrop?.(event);
								return event.defaultPrevented;
							},
							dragover: (event) => {
								ondragover?.(event);
								return false;
							}
						})
					)
				]
			})
		});
		view = editorView;
		editorView.dispatch({ effects: setTagsEffect.of(tags) });

		const unsubscribe = metadataStore.subscribe(() => {
			editorView.dispatch({ effects: refreshEffect.of(null) });
		});

		return () => {
			unsubscribe();
			editorView.destroy();
			view = undefined;
		};
	});

	$effect(() => {
		const next = value;
		if (view !== undefined && !applyingExternal && next !== view.state.doc.toString()) {
			applyingExternal = true;
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
			applyingExternal = false;
		}
	});

	$effect(() => {
		const next = tags;
		view?.dispatch({ effects: setTagsEffect.of(next) });
	});
</script>

<div class="wysiwyg-input" bind:this={container}></div>

<style>
	.wysiwyg-input :global(.cm-editor) {
		font-size: 1rem;
	}

	.wysiwyg-input :global(.cm-editor.cm-focused) {
		outline: none;
	}

	.wysiwyg-input :global(.cm-scroller) {
		font-family: inherit;
		line-height: 1.5;
		min-height: 5.5rem;
		max-height: 20.5rem;
		overflow-y: auto;
	}

	.wysiwyg-input :global(.cm-content) {
		padding: 0.25rem 0.5rem;
	}

	.wysiwyg-input :global(.cm-custom-emoji) {
		max-height: 1.5em;
		max-width: 100%;
		vertical-align: bottom;
	}

	.wysiwyg-input :global(.cm-mention-chip) {
		color: var(--accent);
		background-color: var(--accent-foreground);
		border-radius: 0.5rem;
		padding: 0 0.3rem;
	}

	.wysiwyg-input :global(.cm-hashtag),
	.wysiwyg-input :global(.cm-url),
	.wysiwyg-input :global(.cm-reference),
	.wysiwyg-input :global(.cm-nip) {
		color: var(--accent);
	}

	.wysiwyg-input :global(.cm-media-embed) {
		padding: 0.25rem 0;
	}

	.wysiwyg-input :global(.cm-media-embed img) {
		max-height: 12rem;
		max-width: 100%;
		border-radius: 0.5rem;
	}
</style>
