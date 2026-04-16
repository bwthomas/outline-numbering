/**
 * TipTap extension for Purdue OWL academic outline numbering.
 *
 * Replaces default ordered list markers with the academic cycle:
 *   Depth 0: I, II, III, IV ...     (uppercase Roman)
 *   Depth 1: A, B, C, D ...         (uppercase letter)
 *   Depth 2: 1, 2, 3, 4 ...         (Arabic numeral)
 *   Depth 3: a, b, c, d ...         (lowercase letter)
 *   Depth 4+: cycle repeats
 *
 * Works by attaching CSS counters via a ProseMirror plugin that sets
 * data-outline-depth on each list item based on its nesting level.
 * The actual marker rendering is done in CSS (see getStyles()).
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const OUTLINE_NUMBERING_KEY = new PluginKey('outlineNumbering');

/**
 * Convert an integer to uppercase Roman numeral.
 */
export function toRoman(n: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i];
      n -= vals[i];
    }
  }
  return result;
}

/**
 * Convert an integer (1-based) to a letter sequence.
 * 1→A, 2→B, ..., 26→Z, 27→AA, etc.
 */
export function toLetter(n: number, uppercase: boolean): string {
  let result = '';
  while (n > 0) {
    n--;
    const base = uppercase ? 65 : 97;
    result = String.fromCharCode(base + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

/**
 * Format a 1-based counter value for the given depth in the outline cycle.
 *
 *   depth 0 → Roman (I, II, III)
 *   depth 1 → uppercase letter (A, B, C)
 *   depth 2 → Arabic (1, 2, 3)
 *   depth 3 → lowercase letter (a, b, c)
 *   depth 4+ → cycle repeats
 */
export function formatMarker(counter: number, depth: number): string {
  const phase = depth % 4;
  switch (phase) {
    case 0: return toRoman(counter) + '.';
    case 1: return toLetter(counter, true) + '.';
    case 2: return counter.toString() + '.';
    case 3: return toLetter(counter, false) + '.';
    default: return counter.toString() + '.';
  }
}

/**
 * Walk the document and compute decorations that set data-outline-depth
 * and data-outline-marker on each ordered list item.
 */
function computeDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  function walk(node: any, pos: number, depth: number, counters: number[]) {
    if (node.type.name === 'orderedList') {
      const childCounters = [...counters, 0];
      let offset = pos + 1; // skip opening tag
      node.forEach((child: any, childOffset: number) => {
        if (child.type.name === 'listItem') {
          childCounters[childCounters.length - 1]++;
          const counter = childCounters[childCounters.length - 1];
          const itemPos = offset + childOffset;
          const marker = formatMarker(counter, depth);

          decorations.push(
            Decoration.node(itemPos, itemPos + child.nodeSize, {
              'data-outline-depth': String(depth),
              'data-outline-marker': marker,
            })
          );

          // Recurse into the list item's children for nested lists
          let innerOffset = itemPos + 1;
          child.forEach((grandchild: any) => {
            if (grandchild.type.name === 'orderedList') {
              walk(grandchild, innerOffset, depth + 1, childCounters);
            }
            innerOffset += grandchild.nodeSize;
          });
        }
      });
    } else if (node.type.name === 'doc' || node.type.name === 'listItem') {
      // Traverse into doc and list items looking for ordered lists
      let offset = pos + (node.type.name === 'doc' ? 0 : 1);
      node.forEach((child: any) => {
        if (child.type.name === 'orderedList') {
          walk(child, offset, depth, counters);
        } else {
          // Also recurse into non-list block nodes that might contain lists
          walkNonList(child, offset, depth, counters);
        }
        offset += child.nodeSize;
      });
    }
  }

  function walkNonList(node: any, pos: number, depth: number, counters: number[]) {
    if (!node.isBlock || node.isLeaf) return;
    let offset = pos + 1;
    node.forEach((child: any) => {
      if (child.type.name === 'orderedList') {
        walk(child, offset, depth, counters);
      } else {
        walkNonList(child, offset, depth, counters);
      }
      offset += child.nodeSize;
    });
  }

  walk(doc, 0, 0, []);
  return DecorationSet.create(doc, decorations);
}

export interface OutlineNumberingOptions {
  /**
   * CSS class added to the editor wrapper. Defaults to 'outline-numbering'.
   */
  className: string;
}

export const OutlineNumbering = Extension.create<OutlineNumberingOptions>({
  name: 'outlineNumbering',

  addOptions() {
    return {
      className: 'outline-numbering',
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: OUTLINE_NUMBERING_KEY,
        state: {
          init(_, { doc }) {
            return computeDecorations(doc);
          },
          apply(tr, decorationSet) {
            if (tr.docChanged) {
              return computeDecorations(tr.doc);
            }
            return decorationSet.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

/**
 * Returns CSS that should be injected into the document (or included in SCSS)
 * to style the outline numbering markers.
 *
 * Uses the data-outline-marker attribute set by the ProseMirror plugin
 * as a CSS `content` value via attr().
 *
 * Call this if you want to inject styles programmatically. Otherwise,
 * copy the CSS into your stylesheet.
 */
export function getOutlineNumberingStyles(): string {
  return `
/* Hide default list-style on ordered lists inside the outline editor */
.outline-numbering ol {
  list-style: none;
  padding-left: 0;
}

.outline-numbering ol ol {
  padding-left: 2em;
}

/* Use the data-outline-marker attribute as the list marker */
.outline-numbering li[data-outline-marker] {
  position: relative;
  padding-left: 2.5em;
}

.outline-numbering li[data-outline-marker]::before {
  content: attr(data-outline-marker);
  position: absolute;
  left: 0;
  width: 2em;
  text-align: right;
  font-weight: 500;
  color: inherit;
  opacity: 0.8;
}
`;
}
