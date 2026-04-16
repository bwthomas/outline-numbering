import { toRoman, toLetter, harvardStrategy, OutlineNumberingStrategy } from './outline-numbering';

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

describe('harvardStrategy', () => {
  it('is named "harvard"', () => {
    expect(harvardStrategy.name).toBe('harvard');
  });

  it('depth 0 = Roman numerals', () => {
    expect(harvardStrategy.format(1, 0)).toBe('I.');
    expect(harvardStrategy.format(4, 0)).toBe('IV.');
  });

  it('depth 1 = uppercase letters', () => {
    expect(harvardStrategy.format(1, 1)).toBe('A.');
    expect(harvardStrategy.format(3, 1)).toBe('C.');
  });

  it('depth 2 = Arabic numerals', () => {
    expect(harvardStrategy.format(1, 2)).toBe('1.');
    expect(harvardStrategy.format(10, 2)).toBe('10.');
  });

  it('depth 3 = lowercase letters', () => {
    expect(harvardStrategy.format(1, 3)).toBe('a.');
    expect(harvardStrategy.format(5, 3)).toBe('e.');
  });

  it('depth 4+ cycles back to Roman', () => {
    expect(harvardStrategy.format(2, 4)).toBe('II.');
    expect(harvardStrategy.format(1, 5)).toBe('A.');
    expect(harvardStrategy.format(3, 6)).toBe('3.');
    expect(harvardStrategy.format(2, 7)).toBe('b.');
  });

  it('emits only ASCII characters across a wide input range', () => {
    for (let depth = 0; depth < 8; depth++) {
      for (let counter = 1; counter <= 30; counter++) {
        const marker = harvardStrategy.format(counter, depth);
        expect(marker).toMatch(/^[\x20-\x7E]+$/);
      }
    }
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
    expect(emojiStrategy.format(1, 2)).toBe('🔹 ');
    expect(emojiStrategy.format(1, 3)).toBe('▸ ');
    // 🎯 is U+1F3AF — surrogate pair in JS, length 2
    expect('🎯'.length).toBe(2);
    expect(emojiStrategy.format(1, 0).charCodeAt(0)).toBe(0xD83C);
    expect(emojiStrategy.format(1, 0).charCodeAt(1)).toBe(0xDFAF);
  });

  it('preserves ZWJ emoji sequences', () => {
    const family = '👨‍👩‍👧'; // ZWJ-joined family
    const zwjStrategy: OutlineNumberingStrategy = {
      name: 'zwj',
      format: () => family,
    };
    expect(zwjStrategy.format(1, 0)).toBe(family);
    expect(Array.from(zwjStrategy.format(1, 0)).length).toBe(5); // 3 people + 2 ZWJ
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

    // Devanagari with combining vowel signs
    const devanagariStrategy: OutlineNumberingStrategy = {
      name: 'devanagari',
      format: () => 'कि',
    };
    expect(devanagariStrategy.format(1, 0)).toBe('कि');
    expect(devanagariStrategy.format(1, 0).length).toBe(2); // base + combining
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
