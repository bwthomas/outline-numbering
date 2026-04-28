/**
 * Framework-agnostic ProseMirror plugin for nested ordered-list numbering.
 *
 * The plugin walks the document, counts items per nesting level, and attaches
 * `data-outline-depth` + `data-outline-marker` decorations to each list item.
 * The marker string itself is produced by the caller-supplied strategy, so
 * consumers can render Harvard (I/A/1/a), decimal (1.1.1), legal, emoji, CJK,
 * or any other custom numbering scheme.
 *
 * Consumers turn the attributes into visible markers in CSS, typically via
 * `content: attr(data-outline-marker)` on a `::before` pseudo-element.
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { alphanumericStrategy } from './strategies';

/**
 * Produces the marker string for a given 1-based `counter` at a given nesting
 * `depth`. Implementations must be pure (same inputs → same output); the
 * plugin invokes the strategy once per list item during a walk.
 */
export interface OutlineNumberingStrategy {
  name: string;
  format(counter: number, depth: number): string;
}

export interface OutlineNumberingPluginOptions {
  /** Numbering scheme. Defaults to `alphanumericStrategy` (Harvard I/A/1/a). */
  strategy: OutlineNumberingStrategy;
  /**
   * When true (default), nested orderedLists inside non-orderedList containers
   * (bulletList, blockquote, custom blocks) within a listItem are discovered
   * and numbered at one level deeper. When false, only orderedLists that are
   * direct children of a listItem are numbered.
   */
  descendThroughContainers: boolean;
  /**
   * When true, also emit a widget decoration `<span class="outline-marker">…</span>`
   * at the start of each numbered listItem. Off by default for back-compat — the
   * historical pattern is `::before { content: attr(data-outline-marker); }` in
   * consumer CSS, which leaves the marker invisible to screen readers (SR users
   * hear only "list item"). Turn on to make markers part of the rendered DOM
   * so SR voicing includes them; the consumer's CSS must then style
   * `.outline-marker` instead of `::before`.
   */
  renderMarkerInline: boolean;
  /**
   * Sibling node types that should NOT reset the orderedList counter when
   * they appear between two orderedLists at the same level. Defaults to `[]`
   * (every non-orderedList sibling resets). For example, an outline editor
   * may want callouts/citations placed between list items not to interrupt
   * the numbering of the surrounding list:
   *
   *   [ol[1, 2], citation, ol[3, 4]]   →  numbering stays I, II, III, IV
   *   [ol[1, 2], heading,  ol[3, 4]]   →  numbering resets — I, II, I, II
   *
   * Headings, paragraphs, and any other "hard break" sibling reset the
   * counter even with this option set, unless they're listed too.
   */
  continueAcrossNodeTypes: string[];
}

/**
 * Stable plugin key — exposed so other plugins can read the current
 * DecorationSet via `OUTLINE_NUMBERING_KEY.getState(editorState)`.
 */
export const OUTLINE_NUMBERING_KEY = new PluginKey<DecorationSet>('outlineNumbering');

export function outlineNumberingPlugin(
  options: Partial<OutlineNumberingPluginOptions> = {},
): Plugin<DecorationSet> {
  const strategy = options.strategy ?? alphanumericStrategy;
  const descendThroughContainers = options.descendThroughContainers ?? true;
  const renderMarkerInline = options.renderMarkerInline ?? false;
  const continueAcrossNodeTypes = options.continueAcrossNodeTypes ?? [];

  return new Plugin<DecorationSet>({
    key: OUTLINE_NUMBERING_KEY,
    state: {
      init(_, { doc }) {
        return computeDecorations(doc, strategy, descendThroughContainers, renderMarkerInline, continueAcrossNodeTypes);
      },
      apply(tr, decorationSet) {
        if (tr.docChanged) {
          return computeDecorations(tr.doc, strategy, descendThroughContainers, renderMarkerInline, continueAcrossNodeTypes);
        }
        return decorationSet.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

/**
 * Computes the DecorationSet for a document given a strategy. Exported for
 * programmatic use (tests, custom plugin composition); the plugin itself
 * calls this internally.
 */
export function computeDecorations(
  doc: any,
  strategy: OutlineNumberingStrategy,
  descendThroughContainers: boolean = true,
  renderMarkerInline: boolean = false,
  continueAcrossNodeTypes: string[] = [],
): DecorationSet {
  const decorations: Decoration[] = [];
  const continueSet = new Set(continueAcrossNodeTypes);

  /** Walk a parent's children, handling orderedLists with run-counter
   *  continuity. The runCounter accumulates across consecutive
   *  orderedList siblings (and any siblings whose type is in
   *  continueSet); any other sibling resets the run. */
  function iterateChildren(parent: any, parentChildrenStart: number, depth: number, insideListItem: boolean) {
    let childOffset = 0;
    let runCounter = 0;
    parent.forEach((child: any) => {
      const childPos = parentChildrenStart + childOffset;
      if (child.type.name === 'orderedList') {
        runCounter = walkOrderedList(child, childPos, depth, runCounter);
      } else {
        if (!continueSet.has(child.type.name)) {
          runCounter = 0;
        }
        walk(child, childPos, depth, insideListItem);
      }
      childOffset += child.nodeSize;
    });
  }

  function walk(node: any, pos: number, depth: number, insideListItem: boolean) {
    if (node.type.name === 'orderedList') {
      // Direct call (e.g. recursion landed on an orderedList without
      // going through a parent's iterateChildren). Treat as a fresh run.
      walkOrderedList(node, pos, depth, 0);
      return;
    }
    if (insideListItem && !descendThroughContainers) return;
    if (!node.isBlock || node.isLeaf) return;
    const childrenStart = pos + (node.type.name === 'doc' ? 0 : 1);
    iterateChildren(node, childrenStart, depth, insideListItem);
  }

  /** Walk one orderedList, emitting decorations for its listItem
   *  children. `startCounter` is the running counter inherited from
   *  any preceding orderedList siblings in the same run. Returns the
   *  counter value after the last listItem so the caller can pass it
   *  to the next orderedList in the run. */
  function walkOrderedList(node: any, pos: number, depth: number, startCounter: number): number {
    const offset = pos + 1;
    let counter = startCounter;
    let childOffset = 0;
    node.forEach((child: any) => {
      if (child.type.name !== 'listItem') {
        childOffset += child.nodeSize;
        return;
      }
      counter++;
      const itemPos = offset + childOffset;
      const markerText = strategy.format(counter, depth);
      decorations.push(
        Decoration.node(itemPos, itemPos + child.nodeSize, {
          'data-outline-depth': String(depth),
          'data-outline-marker': markerText,
        }),
      );

      if (renderMarkerInline) {
        // Widget at the start of the listItem renders the marker as part
        // of the DOM so screen readers voice it as content. Pure rendering —
        // not part of the document model, so copy/paste/transactions are
        // unchanged. `side: -1` puts it before any inline content;
        // `pointer-events: none` so clicks pass through to the listItem.
        decorations.push(
          Decoration.widget(itemPos + 1, () => {
            const span = document.createElement('span');
            span.className = 'outline-marker';
            span.setAttribute('aria-hidden', 'false');
            span.setAttribute('data-outline-marker', markerText);
            span.style.pointerEvents = 'none';
            span.textContent = markerText;
            return span;
          }, { side: -1, key: `outline-marker-${depth}-${counter}-${markerText}` }),
        );
      }

      // Recurse into the listItem's children with depth+1, using the
      // same run-counter logic so nested adjacent orderedLists also
      // continue across continue-set siblings.
      iterateChildren(child, itemPos + 1, depth + 1, true);
      childOffset += child.nodeSize;
    });
    return counter;
  }

  walk(doc, 0, 0, false);
  return DecorationSet.create(doc, decorations);
}
