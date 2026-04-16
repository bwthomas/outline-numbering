/**
 * TipTap extension that renders nested ordered-list markers via a pluggable
 * numbering strategy. Default is the Harvard alphanumeric outline
 * (I / A / 1 / a, cycling at depth 4).
 *
 * The plugin walks the document, counts items per nesting level, and attaches
 * `data-outline-depth` + `data-outline-marker` decorations to each list item.
 * Consumers turn those attributes into visible markers in CSS via
 * `content: attr(data-outline-marker)`.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const OUTLINE_NUMBERING_KEY = new PluginKey('outlineNumbering');

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
 * Produces the marker string for a given 1-based counter at a given nesting depth.
 * Implementations are pure — same (counter, depth) in, same string out — so the
 * plugin can call them freely while walking the document.
 */
export interface OutlineNumberingStrategy {
  name: string;
  format(counter: number, depth: number): string;
}

/**
 * Harvard alphanumeric outline:
 *   depth 0 → Roman (I, II, III)
 *   depth 1 → uppercase letter (A, B, C)
 *   depth 2 → Arabic (1, 2, 3)
 *   depth 3 → lowercase letter (a, b, c)
 *   depth 4+ → cycle repeats
 *
 * Widely referenced by Purdue OWL, MLA, and most US high-school/undergrad
 * writing style guides.
 */
export const harvardStrategy: OutlineNumberingStrategy = {
  name: 'harvard',
  format(counter: number, depth: number): string {
    const phase = depth % 4;
    switch (phase) {
      case 0: return toRoman(counter) + '.';
      case 1: return toLetter(counter, true) + '.';
      case 2: return counter.toString() + '.';
      case 3: return toLetter(counter, false) + '.';
      default: return counter.toString() + '.';
    }
  },
};

export function computeDecorations(doc: any, strategy: OutlineNumberingStrategy): DecorationSet {
  const decorations: Decoration[] = [];

  function walk(node: any, pos: number, depth: number, counters: number[]) {
    if (node.type.name === 'orderedList') {
      const childCounters = [...counters, 0];
      let offset = pos + 1;
      node.forEach((child: any, childOffset: number) => {
        if (child.type.name === 'listItem') {
          childCounters[childCounters.length - 1]++;
          const counter = childCounters[childCounters.length - 1];
          const itemPos = offset + childOffset;
          const marker = strategy.format(counter, depth);

          decorations.push(
            Decoration.node(itemPos, itemPos + child.nodeSize, {
              'data-outline-depth': String(depth),
              'data-outline-marker': marker,
            })
          );

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
      let offset = pos + (node.type.name === 'doc' ? 0 : 1);
      node.forEach((child: any) => {
        if (child.type.name === 'orderedList') {
          walk(child, offset, depth, counters);
        } else {
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
  strategy: OutlineNumberingStrategy;
}

export const OutlineNumbering = Extension.create<OutlineNumberingOptions>({
  name: 'outlineNumbering',

  addOptions() {
    return {
      strategy: harvardStrategy,
    };
  },

  addProseMirrorPlugins() {
    const strategy = this.options.strategy;
    return [
      new Plugin({
        key: OUTLINE_NUMBERING_KEY,
        state: {
          init(_, { doc }) {
            return computeDecorations(doc, strategy);
          },
          apply(tr, decorationSet) {
            if (tr.docChanged) {
              return computeDecorations(tr.doc, strategy);
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

