import { Schema, Node as PMNode } from '@tiptap/pm/model';
import {
  computeDecorations,
  harvardStrategy,
  OutlineNumberingStrategy,
} from './outline-numbering';

// Minimal schema with the nodes the walker cares about.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0] },
    text: { group: 'inline' },
    orderedList: {
      group: 'block',
      content: 'listItem+',
      toDOM: () => ['ol', 0],
    },
    bulletList: {
      group: 'block',
      content: 'listItem+',
      toDOM: () => ['ul', 0],
    },
    listItem: {
      content: 'paragraph block*',
      toDOM: () => ['li', 0],
      defining: true,
    },
  },
});

const { doc, paragraph, text, orderedList, bulletList, listItem } = schema.nodes;

function p(body: string): PMNode {
  return paragraph.create(null, body ? schema.text(body) : null);
}
function item(body: string, ...children: PMNode[]): PMNode {
  return listItem.create(null, [p(body), ...children]);
}
function ol(...items: PMNode[]): PMNode {
  return orderedList.create(null, items);
}
function ul(...items: PMNode[]): PMNode {
  return bulletList.create(null, items);
}
function d(...children: PMNode[]): PMNode {
  return doc.create(null, children);
}

/** A strategy that records every (counter, depth) it's asked to format. */
function spyStrategy(): OutlineNumberingStrategy & { calls: Array<[number, number]> } {
  const calls: Array<[number, number]> = [];
  return {
    name: 'spy',
    calls,
    format(counter, depth) {
      calls.push([counter, depth]);
      return `[${counter}@${depth}]`;
    },
  };
}

/** Extracts `{ depth, marker }` tuples from a DecorationSet in document order. */
function extractMarkers(set: any): Array<{ depth: string; marker: string }> {
  const decos: any[] = set.find();
  return decos
    .sort((a, b) => a.from - b.from)
    .map((deco) => ({
      depth: deco.type.attrs['data-outline-depth'],
      marker: deco.type.attrs['data-outline-marker'],
    }));
}

describe('computeDecorations — empty and leaf cases', () => {
  it('returns an empty DecorationSet for an empty doc', () => {
    const set = computeDecorations(d(p('')), harvardStrategy);
    expect(set.find().length).toBe(0);
  });

  it('returns an empty DecorationSet when there are no lists', () => {
    const set = computeDecorations(d(p('hello'), p('world')), harvardStrategy);
    expect(set.find().length).toBe(0);
  });

  it('ignores bullet lists entirely', () => {
    const docWithBullets = d(ul(item('one'), item('two'), item('three')));
    const set = computeDecorations(docWithBullets, harvardStrategy);
    expect(set.find().length).toBe(0);
  });
});

describe('computeDecorations — flat ordered lists', () => {
  it('emits one decoration per item with sequential counters at depth 0', () => {
    const spy = spyStrategy();
    computeDecorations(d(ol(item('a'), item('b'), item('c'))), spy);
    expect(spy.calls).toEqual([[1, 0], [2, 0], [3, 0]]);

    const markers = extractMarkers(
      computeDecorations(d(ol(item('a'), item('b'), item('c'))), harvardStrategy),
    );
    expect(markers).toEqual([
      { depth: '0', marker: 'I.' },
      { depth: '0', marker: 'II.' },
      { depth: '0', marker: 'III.' },
    ]);
  });

  it('resets the counter between sibling ordered lists', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(ol(item('a'), item('b')), p(''), ol(item('c'), item('d'))),
      spy,
    );
    expect(spy.calls).toEqual([[1, 0], [2, 0], [1, 0], [2, 0]]);
  });

  it('handles a single-item list', () => {
    const set = computeDecorations(d(ol(item('only'))), harvardStrategy);
    expect(extractMarkers(set)).toEqual([{ depth: '0', marker: 'I.' }]);
  });
});

describe('computeDecorations — nested ordered lists', () => {
  it('increments depth for directly nested orderedList and resets inner counter', () => {
    const spy = spyStrategy();
    const nested = d(
      ol(
        item('outer-1', ol(item('inner-1'), item('inner-2'))),
        item('outer-2'),
      ),
    );
    computeDecorations(nested, spy);
    expect(spy.calls).toEqual([
      [1, 0], // outer-1
      [1, 1], // inner-1
      [2, 1], // inner-2
      [2, 0], // outer-2
    ]);
  });

  it('tracks depth correctly across four levels (full Harvard cycle)', () => {
    const spy = spyStrategy();
    const deep = d(
      ol(
        item(
          'L0',
          ol(
            item(
              'L1',
              ol(
                item(
                  'L2',
                  ol(item('L3')),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    computeDecorations(deep, spy);
    expect(spy.calls).toEqual([[1, 0], [1, 1], [1, 2], [1, 3]]);
  });

  it('cycles the Harvard phase at depth 4+', () => {
    const deep = d(
      ol(
        item(
          'L0',
          ol(
            item(
              'L1',
              ol(
                item(
                  'L2',
                  ol(
                    item(
                      'L3',
                      ol(item('L4')),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    const markers = extractMarkers(computeDecorations(deep, harvardStrategy)).map((d) => d.marker);
    expect(markers).toEqual(['I.', 'A.', '1.', 'a.', 'I.']);
  });

  it('resets sibling nested lists independently', () => {
    const spy = spyStrategy();
    const doc = d(
      ol(
        item('outer-1', ol(item('1a'), item('1b'))),
        item('outer-2', ol(item('2a'), item('2b'), item('2c'))),
      ),
    );
    computeDecorations(doc, spy);
    expect(spy.calls).toEqual([
      [1, 0], // outer-1
      [1, 1], [2, 1], // inner under outer-1
      [2, 0], // outer-2
      [1, 1], [2, 1], [3, 1], // inner under outer-2
    ]);
  });
});

describe('computeDecorations — mixed list types', () => {
  it('treats an orderedList nested inside a bulletList as depth 0 (bullet lists do not increment depth)', () => {
    // Behavior: walkNonList forwards the same depth when it descends through
    // a non-orderedList container like a bullet list. This documents the rule
    // — consumers get a depth reset if they wrap an ordered list in bullets.
    const spy = spyStrategy();
    const doc = d(
      ul(
        item(
          'bullet-level',
          ol(item('nested-a'), item('nested-b')),
        ),
      ),
    );
    computeDecorations(doc, spy);
    expect(spy.calls).toEqual([[1, 0], [2, 0]]);
  });

  it('does not walk orderedLists nested inside a bulletList inside a listItem', () => {
    // Known limitation: inside a listItem, the walker only recurses into
    // grandchildren that are themselves orderedLists. Any intervening
    // container (bulletList, blockquote, custom block) hides the nested
    // orderedList from the walker. Documented as a regression guard — if we
    // fix this, this test should be updated.
    const spy = spyStrategy();
    const doc = d(
      ol(
        item(
          'outer-1',
          ul(
            item(
              'bullet-1',
              ol(item('hidden')),
            ),
          ),
        ),
      ),
    );
    computeDecorations(doc, spy);
    expect(spy.calls).toEqual([[1, 0]]);
  });

  it('numbers adjacent ordered lists regardless of bullets between them', () => {
    const doc = d(
      ol(item('first')),
      ul(item('bullet')),
      ol(item('second')),
    );
    const markers = extractMarkers(computeDecorations(doc, harvardStrategy)).map((d) => d.marker);
    expect(markers).toEqual(['I.', 'I.']);
  });
});

describe('computeDecorations — decoration attributes', () => {
  it('sets data-outline-depth and data-outline-marker on every list item decoration', () => {
    const doc = d(ol(item('a'), item('b', ol(item('c')))));
    const markers = extractMarkers(computeDecorations(doc, harvardStrategy));
    expect(markers).toEqual([
      { depth: '0', marker: 'I.' },
      { depth: '0', marker: 'II.' },
      { depth: '1', marker: 'A.' },
    ]);
  });

  it('passes custom strategy output verbatim into data-outline-marker', () => {
    const emojiStrategy: OutlineNumberingStrategy = {
      name: 'emoji',
      format: (counter, depth) => `🎯${counter}·${depth}`,
    };
    const doc = d(ol(item('a'), item('b')));
    const markers = extractMarkers(computeDecorations(doc, emojiStrategy)).map((d) => d.marker);
    expect(markers).toEqual(['🎯1·0', '🎯2·0']);
  });

  it('emits exactly one decoration per list item', () => {
    const doc = d(
      ol(
        item('a', ol(item('a-i'), item('a-ii'))),
        item('b'),
        item('c', ol(item('c-i'))),
      ),
    );
    const set = computeDecorations(doc, harvardStrategy);
    expect(set.find().length).toBe(6);
  });
});

describe('computeDecorations — strategy invocation contract', () => {
  it('invokes the strategy exactly once per list item, in document order', () => {
    const spy = spyStrategy();
    const doc = d(
      ol(
        item('1'),
        item('2', ol(item('2a'), item('2b'))),
        item('3'),
      ),
    );
    computeDecorations(doc, spy);
    expect(spy.calls.length).toBe(5);
    expect(spy.calls).toEqual([
      [1, 0], [2, 0], [1, 1], [2, 1], [3, 0],
    ]);
  });

  it('does not invoke the strategy when there are no ordered lists', () => {
    const spy = spyStrategy();
    computeDecorations(d(ul(item('a'), item('b')), p('text')), spy);
    expect(spy.calls).toEqual([]);
  });
});
