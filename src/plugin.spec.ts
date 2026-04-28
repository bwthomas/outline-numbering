import { Schema, Node as PMNode } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import {
  computeDecorations,
  outlineNumberingPlugin,
  OUTLINE_NUMBERING_KEY,
  OutlineNumberingStrategy,
} from './plugin';
import { alphanumericStrategy } from './strategies';

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
    blockquote: {
      group: 'block',
      content: 'block+',
      toDOM: () => ['blockquote', 0],
    },
  },
});

const { doc, paragraph, text, orderedList, bulletList, listItem, blockquote } = schema.nodes;

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
function bq(...children: PMNode[]): PMNode {
  return blockquote.create(null, children);
}
function d(...children: PMNode[]): PMNode {
  return doc.create(null, children);
}

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

function extractMarkers(set: any): Array<{ depth: string; marker: string }> {
  const decos: any[] = set.find();
  return decos
    .sort((a: any, b: any) => a.from - b.from)
    .map((deco: any) => ({
      depth: deco.type.attrs['data-outline-depth'],
      marker: deco.type.attrs['data-outline-marker'],
    }));
}

describe('computeDecorations — empty and leaf cases', () => {
  it('returns an empty DecorationSet for an empty doc', () => {
    const set = computeDecorations(d(p('')), alphanumericStrategy);
    expect(set.find().length).toBe(0);
  });

  it('returns an empty DecorationSet when there are no lists', () => {
    const set = computeDecorations(d(p('hello'), p('world')), alphanumericStrategy);
    expect(set.find().length).toBe(0);
  });

  it('ignores bullet lists at the top level', () => {
    const set = computeDecorations(d(ul(item('one'), item('two'))), alphanumericStrategy);
    expect(set.find().length).toBe(0);
  });
});

describe('computeDecorations — flat ordered lists', () => {
  it('emits one decoration per item with sequential counters at depth 0', () => {
    const spy = spyStrategy();
    computeDecorations(d(ol(item('a'), item('b'), item('c'))), spy);
    expect(spy.calls).toEqual([[1, 0], [2, 0], [3, 0]]);

    const markers = extractMarkers(
      computeDecorations(d(ol(item('a'), item('b'), item('c'))), alphanumericStrategy),
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
    const set = computeDecorations(d(ol(item('only'))), alphanumericStrategy);
    expect(extractMarkers(set)).toEqual([{ depth: '0', marker: 'I.' }]);
  });
});

describe('computeDecorations — nested ordered lists (direct nesting)', () => {
  it('increments depth for directly nested orderedList and resets inner counter', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(ol(item('outer-1', ol(item('inner-1'), item('inner-2'))), item('outer-2'))),
      spy,
    );
    expect(spy.calls).toEqual([[1, 0], [1, 1], [2, 1], [2, 0]]);
  });

  it('tracks depth correctly across four levels (full alphanumeric cycle)', () => {
    const spy = spyStrategy();
    const deep = d(
      ol(item('L0', ol(item('L1', ol(item('L2', ol(item('L3')))))))),
    );
    computeDecorations(deep, spy);
    expect(spy.calls).toEqual([[1, 0], [1, 1], [1, 2], [1, 3]]);
  });

  it('cycles the alphanumeric phase at depth 4+', () => {
    const deep = d(
      ol(item('L0', ol(item('L1', ol(item('L2', ol(item('L3', ol(item('L4')))))))))),
    );
    const markers = extractMarkers(computeDecorations(deep, alphanumericStrategy)).map((x) => x.marker);
    expect(markers).toEqual(['I.', 'A.', '1.', 'a.', 'I.']);
  });

  it('resets sibling nested lists independently', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(
        ol(
          item('outer-1', ol(item('1a'), item('1b'))),
          item('outer-2', ol(item('2a'), item('2b'), item('2c'))),
        ),
      ),
      spy,
    );
    expect(spy.calls).toEqual([
      [1, 0], [1, 1], [2, 1],
      [2, 0], [1, 1], [2, 1], [3, 1],
    ]);
  });
});

describe('computeDecorations — descendThroughContainers (default: true)', () => {
  it('numbers orderedLists nested inside a bulletList inside a listItem', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(ol(item('outer-1', ul(item('bullet-1', ol(item('surfaced'))))))),
      spy,
    );
    expect(spy.calls).toEqual([[1, 0], [1, 1]]);
  });

  it('numbers orderedLists nested inside a blockquote inside a listItem', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(ol(item('outer-1', bq(ol(item('in-quote'), item('in-quote-2')))))),
      spy,
    );
    expect(spy.calls).toEqual([[1, 0], [1, 1], [2, 1]]);
  });

  it('assigns depth relative to the enclosing listItem, not to container chain length', () => {
    // Multiple non-ordered containers stacked between the outer ordered list
    // and the inner ordered list. Depth should still be 1, not 2 or 3.
    const spy = spyStrategy();
    computeDecorations(
      d(ol(item('outer', ul(item('bullet', bq(ol(item('deep')))))))),
      spy,
    );
    expect(spy.calls).toEqual([[1, 0], [1, 1]]);
  });

  it('handles mixed sibling ordered lists at the same container depth', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(
        ol(
          item(
            'outer-1',
            ul(
              item('bullet-a', ol(item('nested-a1'), item('nested-a2'))),
              item('bullet-b', ol(item('nested-b1'))),
            ),
          ),
        ),
      ),
      spy,
    );
    // Outer: (1,0). First bullet's ordered: (1,1), (2,1). Second bullet's ordered: (1,1) — reset.
    expect(spy.calls).toEqual([[1, 0], [1, 1], [2, 1], [1, 1]]);
  });
});

describe('computeDecorations — descendThroughContainers: false (legacy mode)', () => {
  it('does not walk orderedLists nested inside a bulletList inside a listItem', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(ol(item('outer-1', ul(item('bullet-1', ol(item('hidden'))))))),
      spy,
      false,
    );
    expect(spy.calls).toEqual([[1, 0]]);
  });

  it('still numbers directly nested orderedLists even with descent disabled', () => {
    const spy = spyStrategy();
    computeDecorations(
      d(ol(item('outer', ol(item('inner'))))),
      spy,
      false,
    );
    expect(spy.calls).toEqual([[1, 0], [1, 1]]);
  });
});

describe('computeDecorations — top-level mixed content', () => {
  it('numbers adjacent ordered lists regardless of bullets between them', () => {
    const doc = d(ol(item('first')), ul(item('bullet')), ol(item('second')));
    const markers = extractMarkers(computeDecorations(doc, alphanumericStrategy)).map((x) => x.marker);
    expect(markers).toEqual(['I.', 'I.']);
  });

  it('finds orderedLists inside a top-level blockquote', () => {
    const set = computeDecorations(
      d(bq(ol(item('a'), item('b')))),
      alphanumericStrategy,
    );
    expect(extractMarkers(set)).toEqual([
      { depth: '0', marker: 'I.' },
      { depth: '0', marker: 'II.' },
    ]);
  });
});

describe('computeDecorations — decoration attributes', () => {
  it('sets data-outline-depth and data-outline-marker on every list item decoration', () => {
    const doc = d(ol(item('a'), item('b', ol(item('c')))));
    const markers = extractMarkers(computeDecorations(doc, alphanumericStrategy));
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
    const markers = extractMarkers(computeDecorations(doc, emojiStrategy)).map((x) => x.marker);
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
    const set = computeDecorations(doc, alphanumericStrategy);
    expect(set.find().length).toBe(6);
  });
});

describe('computeDecorations — renderMarkerInline (DOM widget mode)', () => {
  it('off by default: emits only node decorations', () => {
    const doc = d(ol(item('a'), item('b')));
    const set = computeDecorations(doc, alphanumericStrategy);
    const decos: any[] = set.find();
    // 2 list items × 1 node decoration each = 2 total when widget mode is off
    expect(decos.length).toBe(2);
    expect(decos.every((d: any) => d.type?.attrs?.['data-outline-marker'])).toBe(true);
  });

  it('renderMarkerInline=true: emits a widget decoration alongside each node decoration', () => {
    const doc = d(ol(item('a'), item('b')));
    const set = computeDecorations(doc, alphanumericStrategy, true, true);
    const decos: any[] = set.find();
    // 2 node decorations + 2 widget decorations = 4 total
    expect(decos.length).toBe(4);
    const widgets = decos.filter((d: any) => d.type?.toDOM != null || d.type?.spec?.toDOM != null);
    // widget decorations have a toDOM constructor on the type
    const nodeDecos = decos.filter((d: any) => d.type?.attrs?.['data-outline-marker']);
    expect(nodeDecos.length).toBe(2);
    expect(widgets.length + nodeDecos.length).toBeGreaterThanOrEqual(4);
  });

  it('renderMarkerInline=true on nested lists also produces widgets', () => {
    const doc = d(ol(item('a', ol(item('a-i'))), item('b')));
    const set = computeDecorations(doc, alphanumericStrategy, true, true);
    // 3 list items × (1 node + 1 widget) = 6 decorations
    expect(set.find().length).toBe(6);
  });
});

describe('outlineNumberingPlugin — ProseMirror plugin integration', () => {
  it('exposes its DecorationSet via OUTLINE_NUMBERING_KEY', () => {
    const state = EditorState.create({
      doc: d(ol(item('a'), item('b'))),
      plugins: [outlineNumberingPlugin()],
    });
    const decorations = OUTLINE_NUMBERING_KEY.getState(state);
    expect(decorations).toBeDefined();
    expect(decorations!.find().length).toBe(2);
  });

  it('defaults to alphanumericStrategy when no strategy is provided', () => {
    const state = EditorState.create({
      doc: d(ol(item('a'))),
      plugins: [outlineNumberingPlugin()],
    });
    const decorations = OUTLINE_NUMBERING_KEY.getState(state)!;
    expect(extractMarkers(decorations)).toEqual([{ depth: '0', marker: 'I.' }]);
  });

  it('honors a custom strategy', () => {
    const customStrategy: OutlineNumberingStrategy = {
      name: 'custom',
      format: (counter) => `<${counter}>`,
    };
    const state = EditorState.create({
      doc: d(ol(item('a'), item('b'))),
      plugins: [outlineNumberingPlugin({ strategy: customStrategy })],
    });
    const markers = extractMarkers(OUTLINE_NUMBERING_KEY.getState(state)!).map((x) => x.marker);
    expect(markers).toEqual(['<1>', '<2>']);
  });

  it('honors descendThroughContainers: false', () => {
    const state = EditorState.create({
      doc: d(ol(item('outer', ul(item('bullet', ol(item('hidden'))))))),
      plugins: [outlineNumberingPlugin({ descendThroughContainers: false })],
    });
    expect(OUTLINE_NUMBERING_KEY.getState(state)!.find().length).toBe(1);
  });
});

describe('computeDecorations — continueAcrossNodeTypes', () => {
  it('default ([]): every non-orderedList sibling resets the counter', () => {
    // [ol[I, II], paragraph, ol[I, II]] — paragraph is the break.
    const document = d(ol(item('a'), item('b')), p('break'), ol(item('c'), item('d')));
    const markers = extractMarkers(
      computeDecorations(document, alphanumericStrategy),
    ).map((x) => x.marker);
    expect(markers).toEqual(['I.', 'II.', 'I.', 'II.']);
  });

  it('with continueAcrossNodeTypes including paragraph: counter continues', () => {
    // Same doc as above, but paragraph is in the continue-set, so the
    // run carries: I, II, [paragraph], III, IV.
    const document = d(ol(item('a'), item('b')), p('soft-break'), ol(item('c'), item('d')));
    const markers = extractMarkers(
      computeDecorations(document, alphanumericStrategy, true, false, ['paragraph']),
    ).map((x) => x.marker);
    expect(markers).toEqual(['I.', 'II.', 'III.', 'IV.']);
  });

  it('non-listed sibling between continue-set siblings still resets the run', () => {
    // [ol[I, II], paragraph, blockquote, ol[I, II]] — blockquote isn't
    // in the continue-set even though paragraph is; the run resets at
    // the blockquote.
    const document = d(
      ol(item('a'), item('b')),
      p('soft'),
      bq(p('hard')),
      ol(item('c'), item('d')),
    );
    const markers = extractMarkers(
      computeDecorations(document, alphanumericStrategy, true, false, ['paragraph']),
    ).map((x) => x.marker);
    expect(markers).toEqual(['I.', 'II.', 'I.', 'II.']);
  });

  it('continuity applies independently at nested depths', () => {
    // listItem at depth 0 contains: ol[a], paragraph (in continue-set), ol[b].
    // Inner counters should continue: A, B (depth 1).
    const document = d(
      ol(
        item('outer-1',
          ol(item('inner-a')),
          p('soft'),
          ol(item('inner-b')),
        ),
      ),
    );
    const markers = extractMarkers(
      computeDecorations(document, alphanumericStrategy, true, false, ['paragraph']),
    ).map((x) => x.marker);
    expect(markers).toEqual(['I.', 'A.', 'B.']);
  });

  it('plugin honors continueAcrossNodeTypes via integration path', () => {
    const state = EditorState.create({
      doc: d(ol(item('a'), item('b')), p('soft'), ol(item('c'), item('d'))),
      plugins: [outlineNumberingPlugin({ continueAcrossNodeTypes: ['paragraph'] })],
    });
    const markers = extractMarkers(OUTLINE_NUMBERING_KEY.getState(state)!).map((x) => x.marker);
    expect(markers).toEqual(['I.', 'II.', 'III.', 'IV.']);
  });
});
