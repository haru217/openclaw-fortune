const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ZODIAC_SIGNS, getZodiacSign } = require('../lib/zodiac');

describe('ZODIAC_SIGNS', () => {
  it('has exactly 12 signs', () => {
    assert.equal(ZODIAC_SIGNS.length, 12);
  });

  it('each sign has required fields', () => {
    for (const sign of ZODIAC_SIGNS) {
      assert.ok(sign.id, `missing id`);
      assert.ok(sign.name, `missing name for ${sign.id}`);
      assert.ok(sign.startMonth, `missing startMonth for ${sign.id}`);
      assert.ok(sign.startDay, `missing startDay for ${sign.id}`);
    }
  });
});

describe('getZodiacSign', () => {
  it('returns aries for March 21', () => {
    const result = getZodiacSign('03-21');
    assert.equal(result.id, 'aries');
  });

  it('returns aries for April 19', () => {
    const result = getZodiacSign('04-19');
    assert.equal(result.id, 'aries');
  });

  it('returns taurus for April 20', () => {
    const result = getZodiacSign('04-20');
    assert.equal(result.id, 'taurus');
  });

  it('returns capricorn for January 1', () => {
    const result = getZodiacSign('01-01');
    assert.equal(result.id, 'capricorn');
  });

  it('returns sagittarius for December 21', () => {
    const result = getZodiacSign('12-21');
    assert.equal(result.id, 'sagittarius');
  });

  it('returns capricorn for December 22', () => {
    const result = getZodiacSign('12-22');
    assert.equal(result.id, 'capricorn');
  });

  it('accepts YYYY-MM-DD format', () => {
    const result = getZodiacSign('1990-10-23');
    assert.equal(result.id, 'scorpio');
  });

  it('throws on invalid input', () => {
    assert.throws(() => getZodiacSign('not-a-date'), /invalid/i);
  });

  it('throws on out-of-range month', () => {
    assert.throws(() => getZodiacSign('13-01'), /invalid/i);
  });
});

const { getZodiacSignFromBirthday } = require('../lib/zodiac');

describe('getZodiacSignFromBirthday', () => {
  it('parses YYYY/MM/DD', () => {
    const result = getZodiacSignFromBirthday('1990/10/23');
    assert.equal(result.id, 'scorpio');
  });

  it('parses YYYY-MM-DD', () => {
    const result = getZodiacSignFromBirthday('1990-05-15');
    assert.equal(result.id, 'taurus');
  });

  it('parses YYYYMMDD', () => {
    const result = getZodiacSignFromBirthday('19901023');
    assert.equal(result.id, 'scorpio');
  });

  it('parses MM/DD (no year)', () => {
    const result = getZodiacSignFromBirthday('05/15');
    assert.equal(result.id, 'taurus');
  });

  it('parses M月D日', () => {
    const result = getZodiacSignFromBirthday('5月15日');
    assert.equal(result.id, 'taurus');
  });

  it('parses MM月DD日', () => {
    const result = getZodiacSignFromBirthday('10月23日');
    assert.equal(result.id, 'scorpio');
  });

  it('returns birthday in result when year is provided', () => {
    const result = getZodiacSignFromBirthday('1990/10/23');
    assert.equal(result.birthday, '1990-10-23');
  });

  it('returns null birthday when no year', () => {
    const result = getZodiacSignFromBirthday('10/23');
    assert.equal(result.birthday, null);
  });

  it('throws on garbage input', () => {
    assert.throws(() => getZodiacSignFromBirthday('hello'), /invalid/i);
  });

  it('throws on empty string', () => {
    assert.throws(() => getZodiacSignFromBirthday(''), /invalid/i);
  });
});
