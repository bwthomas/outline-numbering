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

  return new Plugin<DecorationSet>({
    key: OUTLINE_NUMBERING_KEY,
    state: {
      init(_, { doc }) {
        return computeDecorations(doc, strategy, descendThroughContainers);
      },
      apply(tr, decorationSet) {
        if (tr.docChanged) {
          return computeDecorations(tr.doc, strategy, descendThroughContainers);
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
): DecorationSet {
  const decorations: Decoration[] = [];

  function walk(node: any, pos: number, depth: number, insideListItem: boolean) {
    if (node.type.name === 'orderedList') {
      walkOrderedList(node, pos, depth);
      return;
    }
    if (insideListItem && !descendThroughContainers) return;
    if (!node.isBlock || node.isLeaf) return;
    const offset = pos + (node.type.name === 'doc' ? 0 : 1);
    let childOffset = 0;
    node.forEach((child: any) => {
      walk(child, offset + childOffset, depth, insideListItem);
      childOffset += child.nodeSize;
    });
  }

  function walkOrderedList(node: any, pos: number, depth: number) {
    const offset = pos + 1;
    let counter = 0;
    let childOffset = 0;
    node.forEach((child: any) => {
      if (child.type.name !== 'listItem') {
        childOffset += child.nodeSize;
        return;
      }
      counter++;
      const itemPos = offset + childOffset;
      decorations.push(
        Decoration.node(itemPos, itemPos + child.nodeSize, {
          'data-outline-depth': String(depth),
          'data-outline-marker': strategy.format(counter, depth),
        }),
      );

      let grandOffset = itemPos + 1;
      child.forEach((grandchild: any) => {
        walk(grandchild, grandOffset, depth + 1, true);
        grandOffset += grandchild.nodeSize;
      });
      childOffset += child.nodeSize;
    });
  }

  walk(doc, 0, 0, false);
  return DecorationSet.create(doc, decorations);
}
