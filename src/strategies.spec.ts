import {
  toRoman,
  toLetter,
  alphanumericStrategy,
  harvardStrategy,
  purdueOwlStrategy,
  decimalStrategy,
  legalStrategy,
  arabicStrategy,
  lowerRomanStrategy,
} from './strategies';
import type { OutlineNumberingStrategy } from './plugin';

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
    expect(toRoman(1994)).toBe('MCMXCIV');
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
    expect(toLetter(52, true)).toBe('AZ');
    expect(toLetter(53, true)).toBe('BA');
  });

  it('converts to lowercase letters', () => {
    expect(toLetter(1, false)).toBe('a');
    expect(toLetter(3, false)).toBe('c');
    expect(toLetter(26, false)).toBe('z');
  });
});

describe('alphanumericStrategy (aka harvardStrategy)', () => {
  it('is named "alphanumeric"', () => {
    expect(alphanumericStrategy.name).toBe('alphanumeric');
  });

  it('harvardStrategy and purdueOwlStrategy are aliases for alphanumericStrategy', () => {
    expect(harvardStrategy).toBe(alphanumericStrategy);
    expect(purdueOwlStrategy).toBe(alphanumericStrategy);
  });

  it('depth 0 = Roman numerals', () => {
    expect(alphanumericStrategy.format(1, 0)).toBe('I.');
    expect(alphanumericStrategy.format(4, 0)).toBe('IV.');
  });

  it('depth 1 = uppercase letters', () => {
    expect(alphanumericStrategy.format(1, 1)).toBe('A.');
    expect(alphanumericStrategy.format(3, 1)).toBe('C.');
  });

  it('depth 2 = Arabic numerals', () => {
    expect(alphanumericStrategy.format(1, 2)).toBe('1.');
    expect(alphanumericStrategy.format(10, 2)).toBe('10.');
  });

  it('depth 3 = lowercase letters', () => {
    expect(alphanumericStrategy.format(1, 3)).toBe('a.');
    expect(alphanumericStrategy.format(5, 3)).toBe('e.');
  });

  it('depth 4+ cycles back to Roman', () => {
    expect(alphanumericStrategy.format(2, 4)).toBe('II.');
    expect(alphanumericStrategy.format(1, 5)).toBe('A.');
    expect(alphanumericStrategy.format(3, 6)).toBe('3.');
    expect(alphanumericStrategy.format(2, 7)).toBe('b.');
  });

  it('emits only printable ASCII across a wide input range', () => {
    for (let depth = 0; depth < 8; depth++) {
      for (let counter = 1; counter <= 30; counter++) {
        expect(alphanumericStrategy.format(counter, depth)).toMatch(/^[\x20-\x7E]+$/);
      }
    }
  });
});

describe('decimalStrategy', () => {
  it('is named "decimal"', () => {
    expect(decimalStrategy.name).toBe('decimal');
  });

  it('emits counter + "." at every depth (trailing-level only)', () => {
    expect(decimalStrategy.format(1, 0)).toBe('1.');
    expect(decimalStrategy.format(2, 0)).toBe('2.');
    expect(decimalStrategy.format(1, 1)).toBe('1.');
    expect(decimalStrategy.format(5, 2)).toBe('5.');
    expect(decimalStrategy.format(17, 9)).toBe('17.');
  });
});

describe('legalStrategy', () => {
  it('is named "legal"', () => {
    expect(legalStrategy.name).toBe('legal');
  });

  it('depth 0 = upper Roman', () => {
    expect(legalStrategy.format(1, 0)).toBe('I.');
    expect(legalStrategy.format(4, 0)).toBe('IV.');
  });

  it('depth 1 = upper letter', () => {
    expect(legalStrategy.format(1, 1)).toBe('A.');
  });

  it('depth 2 = Arabic', () => {
    expect(legalStrategy.format(3, 2)).toBe('3.');
  });

  it('depth 3 = lower letter', () => {
    expect(legalStrategy.format(2, 3)).toBe('b.');
  });

  it('depth 4 = parenthesized Arabic', () => {
    expect(legalStrategy.format(1, 4)).toBe('(1)');
    expect(legalStrategy.format(10, 4)).toBe('(10)');
  });

  it('depth 5 = parenthesized lowercase letter', () => {
    expect(legalStrategy.format(1, 5)).toBe('(a)');
    expect(legalStrategy.format(27, 5)).toBe('(aa)');
  });

  it('depth 6 = parenthesized lowercase Roman', () => {
    expect(legalStrategy.format(1, 6)).toBe('(i)');
    expect(legalStrategy.format(4, 6)).toBe('(iv)');
  });

  it('depth 7+ cycles back to upper Roman', () => {
    expect(legalStrategy.format(1, 7)).toBe('I.');
    expect(legalStrategy.format(1, 8)).toBe('A.');
    expect(legalStrategy.format(1, 13)).toBe('(i)');
    expect(legalStrategy.format(1, 14)).toBe('I.');
  });
});

describe('arabicStrategy', () => {
  it('is named "arabic"', () => {
    expect(arabicStrategy.name).toBe('arabic');
  });

  it('emits counter + "." at every depth', () => {
    expect(arabicStrategy.format(1, 0)).toBe('1.');
    expect(arabicStrategy.format(99, 7)).toBe('99.');
  });
});

describe('lowerRomanStrategy', () => {
  it('is named "lower-roman"', () => {
    expect(lowerRomanStrategy.name).toBe('lower-roman');
  });

  it('emits lowercase Roman + "." at every depth', () => {
    expect(lowerRomanStrategy.format(1, 0)).toBe('i.');
    expect(lowerRomanStrategy.format(4, 1)).toBe('iv.');
    expect(lowerRomanStrategy.format(9, 2)).toBe('ix.');
    expect(lowerRomanStrategy.format(50, 7)).toBe('l.');
  });
});

describe('custom strategies with Unicode and emoji markers', () => {
  it('preserves emoji glyphs (non-BMP, surrogate pairs)', () => {
    const emojiStrategy: OutlineNumberingStrategy = {
      name: 'emoji',
      format(counter, depth) {
        const glyphs = ['🎯', '✦', '🔹', '▸'];
        return `${glyphs[depth % glyphs.length]} `;
      },
    };
    expect(emojiStrategy.format(1, 0)).toBe('🎯 ');
    expect(emojiStrategy.format(4, 1)).toBe('✦ ');
    expect('🎯'.length).toBe(2);
    expect(emojiStrategy.format(1, 0).charCodeAt(0)).toBe(0xD83C);
    expect(emojiStrategy.format(1, 0).charCodeAt(1)).toBe(0xDFAF);
  });

  it('preserves ZWJ emoji sequences', () => {
    const family = '👨‍👩‍👧';
    const zwjStrategy: OutlineNumberingStrategy = {
      name: 'zwj',
      format: () => family,
    };
    expect(zwjStrategy.format(1, 0)).toBe(family);
    expect(Array.from(zwjStrategy.format(1, 0)).length).toBe(5);
  });

  it('preserves CJK ordinals', () => {
    const heavenlyStems = '甲乙丙丁戊己庚辛壬癸';
    const cjkStrategy: OutlineNumberingStrategy = {
      name: 'heavenly-stems',
      format(counter) {
        return heavenlyStems.charAt((counter - 1) % heavenlyStems.length) + '、';
      },
    };
    expect(cjkStrategy.format(1, 0)).toBe('甲、');
    expect(cjkStrategy.format(10, 0)).toBe('癸、');
    expect(cjkStrategy.format(11, 0)).toBe('甲、');
  });

  it('preserves RTL scripts and combining marks', () => {
    const hebrewStrategy: OutlineNumberingStrategy = {
      name: 'hebrew',
      format(counter) {
        return 'אבגדהוזחטי'.charAt((counter - 1) % 10) + '.';
      },
    };
    expect(hebrewStrategy.format(1, 0)).toBe('א.');
    expect(hebrewStrategy.format(3, 0)).toBe('ג.');

    const devanagariStrategy: OutlineNumberingStrategy = {
      name: 'devanagari',
      format: () => 'कि',
    };
    expect(devanagariStrategy.format(1, 0)).toBe('कि');
    expect(devanagariStrategy.format(1, 0).length).toBe(2);
  });

  it('round-trips Unicode through JSON serialization (ProseMirror attr path)', () => {
    const mixedStrategy: OutlineNumberingStrategy = {
      name: 'mixed',
      format: (counter, depth) => `${depth}·🎯·${counter}→甲`,
    };
    const marker = mixedStrategy.format(3, 2);
    const roundTripped = JSON.parse(JSON.stringify({ 'data-outline-marker': marker }));
    expect(roundTripped['data-outline-marker']).toBe('2·🎯·3→甲');
  });
});
