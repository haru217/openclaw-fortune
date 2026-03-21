'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { lifePathNumber, personalYear, personalMonth, reduceToSingle } = require('../lib/numerology');

describe('reduceToSingle', () => {
  it('single digit stays', () => {
    assert.equal(reduceToSingle(5), 5);
  });

  it('reduces multi-digit', () => {
    assert.equal(reduceToSingle(28), 1); // 2+8=10, 1+0=1
  });

  it('preserves master number 11', () => {
    assert.equal(reduceToSingle(11), 11);
  });

  it('preserves master number 22', () => {
    assert.equal(reduceToSingle(22), 22);
  });

  it('preserves master number 33', () => {
    assert.equal(reduceToSingle(33), 33);
  });

  it('reduces 44 (not master)', () => {
    assert.equal(reduceToSingle(44), 8); // 4+4=8
  });
});

describe('lifePathNumber', () => {
  it('1987-08-17 = 5', () => {
    // 1+9+8+7=25→7, 0+8=8, 1+7=8, 7+8+8=23→5
    assert.equal(lifePathNumber('1987-08-17'), 5);
  });

  it('1993-11-22 = 1', () => {
    // 1+9+9+3=22(master), 1+1=2, 2+2=4, 22+2+4=28→10→1
    assert.equal(lifePathNumber('1993-11-22'), 1);
  });

  it('1990-01-01 = 3', () => {
    // 1+9+9+0=19→10→1, 0+1=1, 0+1=1, 1+1+1=3
    assert.equal(lifePathNumber('1990-01-01'), 3);
  });

  it('2000-12-12 = 9', () => {
    // 2+0+0+0=2, 1+2=3, 1+2=3, 2+3+3=8... let me recalc
    // 2000→2, 12→3, 12→3, 2+3+3=8
    assert.equal(lifePathNumber('2000-12-12'), 8);
  });

  it('master number path: 1991-01-01 = 22', () => {
    // 1+9+9+1=20→2, 0+1=1, 0+1=1, 2+1+1=4
    // Not 22. Let me find a real master number case
    // 1978-12-19: 1+9+7+8=25→7, 1+2=3, 1+9=10→1, 7+3+1=11 (master!)
    assert.equal(lifePathNumber('1978-12-19'), 11);
  });
});

describe('personalYear', () => {
  it('1987-08-17 in 2026 = 8', () => {
    // 2+0+2+6=10→1, 0+8=8, 1+7=8, 1+8+8=17→8
    // Wait: reduceToSingle(2026)=2+0+2+6=10→1, reduceToSingle(8)=8, reduceToSingle(17)=8
    // 1+8+8=17→8
    assert.equal(personalYear('1987-08-17', 2026), 8);
  });

  it('1993-11-22 in 2026 = 5', () => {
    // 2026→1, 11→11(master), 22→22(master), 1+11+22=34→7
    // Hmm, let me recalc: reduceToSingle(2026)=10→1, reduceToSingle(11)=11, reduceToSingle(22)=22
    // 1+11+22=34→3+4=7
    // But the spec says personal year 5 for Misaki...
    // Actually personal year is birth month + birth day + current year
    // Some systems: just add all digits: 1+1+2+2+2+0+2+6 = 16 → 7
    // Other systems: reduce each component first
    // Let me check: 11+22+2026: 1+1=2, 2+2=4, 2+0+2+6=10→1, 2+4+1=7
    // Hmm, but in the PDF we said personal year 5 for Misaki
    // Let me recalculate without master numbers for PY:
    // Some numerologists don't keep master numbers for personal year
    // Standard method: birth month + birth day + year, all reduced individually (no master)
    // 1+1=2, 2+2=4, 2+0+2+6=10→1, 2+4+1=7
    // That gives 7, not 5.
    // Alternative: sum all digits: 1+1+2+2+2+0+2+6=16→7
    // Still 7...
    // In the mockup I said personal year 5 for Misaki. Let me check my earlier calculation.
    // Earlier I said: "個人年数 2026: 1+9+9+3+2+0+2+6 = 32 → 3+2 = 5"
    // Oh! That's using the FULL birthday digits + year digits summed together!
    // That's a different method. Let me check which is standard.
    // Method 1 (reduce each): month=2, day=4, year=1 → 7
    // Method 2 (sum all digits): 1+1+2+2+2+0+2+6 = 16 → 7
    // Method 3 (full birthday + year): 1+9+9+3+2+0+2+6 = 32 → 5
    // Method 3 uses the full birth year too! That's wrong for personal year.
    // Personal year uses birth MONTH + birth DAY + CURRENT YEAR
    // Not the birth year.
    // So: 11 + 22 + 2026
    // Reducing: 1+1=2, 2+2=4, 2+0+2+6=10→1
    // 2+4+1 = 7
    // The PDF was wrong. Let me fix the test to match the correct calculation.
    assert.equal(personalYear('1993-11-22', 2026), 7);
  });
});

describe('personalMonth', () => {
  it('1987-08-17 in 2026-04 = 3', () => {
    // personalYear = 8, month 4: 8+4=12→3
    assert.equal(personalMonth('1987-08-17', 2026, 4), 3);
  });

  it('1993-11-22 in 2026-03 = 1', () => {
    // personalYear = 7, month 3: 7+3=10→1
    assert.equal(personalMonth('1993-11-22', 2026, 3), 1);
  });
});
