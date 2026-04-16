/**
 * Built-in numbering strategies.
 *
 * Each strategy is a pure function of (counter, depth) → string. Consumers can
 * use these directly or implement their own (emoji markers, CJK ordinals,
 * custom cycles, etc.).
 */
import type { OutlineNumberingStrategy } from './plugin';

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
 * Alphanumeric outline (also known as "Harvard outline").
 *   depth 0 → Roman (I, II, III)
 *   depth 1 → uppercase letter (A, B, C)
 *   depth 2 → Arabic (1, 2, 3)
 *   depth 3 → lowercase letter (a, b, c)
 *   depth 4+ → cycles back to depth 0
 *
 * Canonical form documented by Purdue OWL, MLA, and most US writing style
 * guides.
 */
export const alphanumericStrategy: OutlineNumberingStrategy = {
  name: 'alphanumeric',
  format(counter, depth) {
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

/**
 * Alias for `alphanumericStrategy`. "Harvard outline" is a common informal
 * name, though "Harvard" in academic/British contexts more commonly denotes
 * citation style — if that ambiguity bothers you, prefer
 * `alphanumericStrategy`.
 */
export const harvardStrategy = alphanumericStrategy;

/**
 * Alias for `alphanumericStrategy`. Purdue OWL (Online Writing Lab) is the
 * most widely cited documentation of this scheme and the first reference a
 * lot of writers encounter it through.
 */
export const purdueOwlStrategy = alphanumericStrategy;

/**
 * Decimal outline (ISO 2145, IETF).
 *   depth 0 → 1., 2., 3.
 *   depth 1 → 1.1., 1.2., 2.1.
 *   depth 2 → 1.1.1., 1.1.2.
 *   ... and so on, indefinitely.
 *
 * Used in technical documentation, engineering reports, software
 * specifications, and European academic writing.
 *
 * Note: the strategy interface does not see the full ancestor chain — the
 * plugin calls `format(counter, depth)` with only the item's own counter.
 * Proper decimal numbering (e.g. "1.2.3") requires ancestor context, so this
 * strategy emits a trailing-level marker only ("3." at depth 2). If you need
 * full decimal prefixes, wire them through a custom CSS pseudo-element using
 * `counter-reset` / `counters(ol, ".")` instead.
 */
export const decimalStrategy: OutlineNumberingStrategy = {
  name: 'decimal',
  format(counter) {
    return counter.toString() + '.';
  },
};

/**
 * Legal / extended alphanumeric outline.
 *   depth 0 → I., II., III.
 *   depth 1 → A., B., C.
 *   depth 2 → 1., 2., 3.
 *   depth 3 → a., b., c.
 *   depth 4 → (1), (2), (3)
 *   depth 5 → (a), (b), (c)
 *   depth 6 → (i), (ii), (iii)
 *   depth 7+ → cycles back to depth 0
 *
 * Common in US legal writing (briefs, bylaws, statutes) and full-depth
 * academic outlines.
 */
export const legalStrategy: OutlineNumberingStrategy = {
  name: 'legal',
  format(counter, depth) {
    const phase = depth % 7;
    switch (phase) {
      case 0: return toRoman(counter) + '.';
      case 1: return toLetter(counter, true) + '.';
      case 2: return counter.toString() + '.';
      case 3: return toLetter(counter, false) + '.';
      case 4: return '(' + counter.toString() + ')';
      case 5: return '(' + toLetter(counter, false) + ')';
      case 6: return '(' + toRoman(counter).toLowerCase() + ')';
      default: return counter.toString() + '.';
    }
  },
};

/**
 * Flat Arabic numerals at every depth: 1., 2., 3. — no depth awareness.
 * Useful for simple numbered lists or as a building block for custom
 * strategies.
 */
export const arabicStrategy: OutlineNumberingStrategy = {
  name: 'arabic',
  format(counter) {
    return counter.toString() + '.';
  },
};

/**
 * Flat lowercase Roman numerals at every depth: i., ii., iii. — no depth
 * awareness. Matches CSS `list-style-type: lower-roman`. Rare as a root
 * outline style; useful for prefaces, appendices, or as a building block.
 */
export const lowerRomanStrategy: OutlineNumberingStrategy = {
  name: 'lower-roman',
  format(counter) {
    return toRoman(counter).toLowerCase() + '.';
  },
};
