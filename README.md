# @bwthomas/outline-numbering

Framework-agnostic ProseMirror plugin (with Tiptap wrapper) for nested ordered-list numbering with pluggable strategies.

- **Alphanumeric** (Harvard / Purdue OWL) — `I. A. 1. a.`
- **Decimal** — `1. 2. 3.` at every depth (pair with CSS counters for `1.1.1.` composition)
- **Legal** — `I. A. 1. a. (1) (a) (i)` across 7 levels
- **Arabic flat** — plain numbered lists
- **Lower Roman flat** — `i. ii. iii.`
- **Custom** — any `(counter, depth) → string` you like (emoji, CJK, whatever)

## Install

```sh
npm install @bwthomas/outline-numbering
```

Peer deps: `prosemirror-state`, `prosemirror-view`. `@tiptap/core` is required only if you use the Tiptap wrapper.

## Usage

### Tiptap

```ts
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { OutlineNumbering } from '@bwthomas/outline-numbering/tiptap';
import { decimalStrategy } from '@bwthomas/outline-numbering';

new Editor({
  extensions: [
    StarterKit,
    OutlineNumbering.configure({ strategy: decimalStrategy }),
  ],
});
```

### Raw ProseMirror

```ts
import { EditorState } from 'prosemirror-state';
import { outlineNumberingPlugin, alphanumericStrategy } from '@bwthomas/outline-numbering';

const state = EditorState.create({
  doc: myDoc,
  plugins: [
    outlineNumberingPlugin({ strategy: alphanumericStrategy }),
    ...otherPlugins,
  ],
});
```

### CSS

The plugin only attaches data attributes. Style the markers yourself:

```css
ol li[data-outline-marker] {
  position: relative;
  padding-left: 2.5em;
  list-style: none;
}

ol li[data-outline-marker]::before {
  content: attr(data-outline-marker);
  position: absolute;
  left: 0;
  width: 2em;
  text-align: right;
  opacity: 0.8;
}
```

## Strategies

```ts
import {
  alphanumericStrategy,  // I. A. 1. a. — the default
  harvardStrategy,       // alias for alphanumericStrategy
  purdueOwlStrategy,     // alias for alphanumericStrategy
  decimalStrategy,       // 1. at every depth
  legalStrategy,         // I. A. 1. a. (1) (a) (i) over 7 levels
  arabicStrategy,        // 1. at every depth
  lowerRomanStrategy,    // i. at every depth
} from '@bwthomas/outline-numbering';
```

### Custom strategies

```ts
import type { OutlineNumberingStrategy } from '@bwthomas/outline-numbering';

const emojiStrategy: OutlineNumberingStrategy = {
  name: 'emoji',
  format(counter, depth) {
    const glyphs = ['🎯', '✦', '🔹', '▸'];
    return `${glyphs[depth % glyphs.length]} `;
  },
};
```

The `format` function must be pure. It's called once per list item during every walk of the document.

## Options

```ts
outlineNumberingPlugin({
  strategy: alphanumericStrategy,
  descendThroughContainers: true,
});
```

- **`strategy`** — any `OutlineNumberingStrategy`. Default: `alphanumericStrategy`.
- **`descendThroughContainers`** — when `true` (default), ordered lists nested inside non-ordered containers (bullet lists, blockquotes, custom blocks) within a list item are discovered and numbered one level deeper than the enclosing item. When `false`, only ordered lists that are direct children of a list item are walked.

## API

```ts
// Framework-agnostic
import {
  outlineNumberingPlugin,   // (options?) => Plugin<DecorationSet>
  computeDecorations,       // (doc, strategy, descendThroughContainers?) => DecorationSet
  OUTLINE_NUMBERING_KEY,    // PluginKey — use to read plugin state from other plugins
  OutlineNumberingStrategy,
  OutlineNumberingPluginOptions,
  toRoman,
  toLetter,
  // ...all named strategies
} from '@bwthomas/outline-numbering';

// Tiptap wrapper
import { OutlineNumbering, OutlineNumberingOptions } from '@bwthomas/outline-numbering/tiptap';
```

## Things to keep in mind if you fork this

Short list of conventions worth preserving if you take this in a different direction:

- **Support both raw ProseMirror and Tiptap from a single package.** The main entry (`./`) is framework-neutral; the Tiptap wrapper lives at the `/tiptap` subpath. `@tiptap/core` is declared as an optional peer via `peerDependenciesMeta`, so raw-PM users don't get pulled into the Tiptap dep tree. Keep this split if you keep the repo; drop it only if you deliberately commit to one framework.
- **Strategies are pure.** `format(counter, depth) → string`, same inputs → same output, no closures over mutable state. The plugin invokes them during a walk and assumes no side effects.
- **Keep the plugin render-only.** It attaches data attributes; it never manipulates the document or dispatches transactions. That's what keeps it composable with collaborative editing (Yjs) and undo/redo — the walker runs against the current doc and produces decorations, full stop.
- **Alphanumeric is the canonical name; `harvardStrategy` / `purdueOwlStrategy` are aliases.** If you add more, prefer the technical/neutral name as primary and informal names as aliases.
- **Future: consider wrappers for Lexical, Slate, other editor frameworks.** The walker is framework-agnostic in principle — only the plugin lifecycle differs.

## License

MIT — see [LICENSE](./LICENSE).
