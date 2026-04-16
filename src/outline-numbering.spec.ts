import { toRoman, toLetter, formatMarker } from './outline-numbering';

describe('toRoman', () => {
  it('converts small numbers', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(2)).toBe('II');
    expect(toRoman(3)).toBe('III');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(5)).toBe('V');
  });

  it('converts larger numbers', () => {
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(10)).toBe('X');
    expect(toRoman(14)).toBe('XIV');
    expect(toRoman(40)).toBe('XL');
    expect(toRoman(50)).toBe('L');
  });
});

describe('toLetter', () => {
  it('converts to uppercase letters', () => {
    expect(toLetter(1, true)).toBe('A');
    expect(toLetter(2, true)).toBe('B');
    expect(toLetter(26, true)).toBe('Z');
  });

  it('wraps past Z', () => {
    expect(toLetter(27, true)).toBe('AA');
    expect(toLetter(28, true)).toBe('AB');
  });

  it('converts to lowercase letters', () => {
    expect(toLetter(1, false)).toBe('a');
    expect(toLetter(3, false)).toBe('c');
    expect(toLetter(26, false)).toBe('z');
  });
});

describe('formatMarker', () => {
  it('depth 0 = Roman numerals', () => {
    expect(formatMarker(1, 0)).toBe('I.');
    expect(formatMarker(4, 0)).toBe('IV.');
  });

  it('depth 1 = uppercase letters', () => {
    expect(formatMarker(1, 1)).toBe('A.');
    expect(formatMarker(3, 1)).toBe('C.');
  });

  it('depth 2 = Arabic numerals', () => {
    expect(formatMarker(1, 2)).toBe('1.');
    expect(formatMarker(10, 2)).toBe('10.');
  });

  it('depth 3 = lowercase letters', () => {
    expect(formatMarker(1, 3)).toBe('a.');
    expect(formatMarker(5, 3)).toBe('e.');
  });

  it('depth 4+ cycles back to Roman', () => {
    expect(formatMarker(2, 4)).toBe('II.');
    expect(formatMarker(1, 5)).toBe('A.');
    expect(formatMarker(3, 6)).toBe('3.');
    expect(formatMarker(2, 7)).toBe('b.');
  });
});
