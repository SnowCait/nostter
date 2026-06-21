import { Decoration, WidgetType, EditorView, type DecorationSet } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder, type EditorState } from '@codemirror/state';
import { get } from 'svelte/store';
import { nip19 } from 'nostr-tools';
import { Content } from '$lib/Content';
import { metadataStore } from '$lib/cache/Events';

export const setTagsEffect = StateEffect.define<string[][]>();
export const refreshEffect = StateEffect.define<null>();

class EmojiWidget extends WidgetType {
	constructor(
		readonly shortcode: string,
		readonly url: string
	) {
		super();
	}

	eq(other: EmojiWidget): boolean {
		return other.url === this.url && other.shortcode === this.shortcode;
	}

	toDOM(): HTMLElement {
		const img = document.createElement('img');
		img.src = this.url;
		img.alt = this.shortcode;
		img.title = this.shortcode;
		img.className = 'cm-custom-emoji';
		return img;
	}
}

class MentionWidget extends WidgetType {
	constructor(
		readonly label: string,
		readonly raw: string
	) {
		super();
	}

	eq(other: MentionWidget): boolean {
		return other.raw === this.raw && other.label === this.label;
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-mention-chip';
		span.textContent = `@${this.label}`;
		return span;
	}
}

class MediaWidget extends WidgetType {
	constructor(readonly url: string) {
		super();
	}

	eq(other: MediaWidget): boolean {
		return other.url === this.url;
	}

	toDOM(): HTMLElement {
		const wrap = document.createElement('div');
		wrap.className = 'cm-media-embed';
		const img = document.createElement('img');
		img.src = this.url;
		img.loading = 'lazy';
		wrap.appendChild(img);
		return wrap;
	}
}

const hashtagMark = Decoration.mark({ class: 'cm-token cm-hashtag' });
const urlMark = Decoration.mark({ class: 'cm-token cm-url' });
const nipMark = Decoration.mark({ class: 'cm-token cm-nip' });
const referenceMark = Decoration.mark({ class: 'cm-token cm-reference' });

function mentionLabel(text: string): string | undefined {
	const match = text.match(/(npub1\w+|nprofile1\w+)/);
	if (match === null) {
		return undefined;
	}
	try {
		const decoded = nip19.decode(match[1]);
		let pubkey: string | undefined;
		if (decoded.type === 'npub') {
			pubkey = decoded.data;
		} else if (decoded.type === 'nprofile') {
			pubkey = decoded.data.pubkey;
		}
		if (pubkey === undefined) {
			return undefined;
		}
		const metadata = get(metadataStore).get(pubkey);
		if (metadata !== undefined) {
			return metadata.displayName;
		}
		return `${nip19.npubEncode(pubkey).slice(0, 12)}…`;
	} catch {
		return undefined;
	}
}

function isImageUrl(url: string): boolean {
	return /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?\S*)?$/i.test(url);
}

function isOwnLine(content: string, from: number, to: number): boolean {
	const before = from === 0 || content[from - 1] === '\n';
	const after = to === content.length || content[to] === '\n';
	return before && after;
}

interface DecorationState {
	decorations: DecorationSet;
	atomic: DecorationSet;
}

function build(state: EditorState): DecorationState {
	const content = state.doc.toString();
	if (content.length === 0) {
		return { decorations: Decoration.none, atomic: Decoration.none };
	}

	const tags = state.field(tagsField);
	const tokens = Content.parse(content, tags);

	type Entry = { from: number; to: number; value: Decoration; atomic: boolean; side: number };
	const entries: Entry[] = [];

	for (const token of tokens) {
		const from = token.start;
		const to = token.start + token.text.length;
		switch (token.type) {
			case 'emoji':
				entries.push({
					from,
					to,
					value: Decoration.replace({ widget: new EmojiWidget(token.text, token.url) }),
					atomic: true,
					side: 0
				});
				break;
			case 'reference': {
				const label = mentionLabel(token.text);
				if (label !== undefined) {
					entries.push({
						from,
						to,
						value: Decoration.replace({
							widget: new MentionWidget(label, token.text)
						}),
						atomic: true,
						side: 0
					});
				} else {
					entries.push({ from, to, value: referenceMark, atomic: false, side: 0 });
				}
				break;
			}
			case 'hashtag':
				entries.push({ from, to, value: hashtagMark, atomic: false, side: 0 });
				break;
			case 'url':
				entries.push({ from, to, value: urlMark, atomic: false, side: 0 });
				if (isImageUrl(token.text) && isOwnLine(content, from, to)) {
					entries.push({
						from: to,
						to,
						value: Decoration.widget({
							widget: new MediaWidget(token.text),
							block: true,
							side: 1
						}),
						atomic: false,
						side: 1
					});
				}
				break;
			case 'relay':
				entries.push({ from, to, value: urlMark, atomic: false, side: 0 });
				break;
			case 'nip':
				entries.push({ from, to, value: nipMark, atomic: false, side: 0 });
				break;
		}
	}

	entries.sort((a, b) => a.from - b.from || a.side - b.side);

	const decorations = new RangeSetBuilder<Decoration>();
	const atomic = new RangeSetBuilder<Decoration>();
	for (const entry of entries) {
		decorations.add(entry.from, entry.to, entry.value);
		if (entry.atomic) {
			atomic.add(entry.from, entry.to, entry.value);
		}
	}

	return { decorations: decorations.finish(), atomic: atomic.finish() };
}

const tagsField = StateField.define<string[][]>({
	create: () => [],
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setTagsEffect)) {
				return effect.value;
			}
		}
		return value;
	}
});

const decorationField = StateField.define<DecorationState>({
	create: (state) => build(state),
	update(value, tr) {
		if (
			tr.docChanged ||
			tr.effects.some((effect) => effect.is(setTagsEffect) || effect.is(refreshEffect))
		) {
			return build(tr.state);
		}
		return {
			decorations: value.decorations.map(tr.changes),
			atomic: value.atomic.map(tr.changes)
		};
	}
});

export const editorDecorations = [
	tagsField,
	decorationField,
	EditorView.decorations.from(decorationField, (value) => value.decorations),
	EditorView.atomicRanges.of((view) => view.state.field(decorationField).atomic)
];
