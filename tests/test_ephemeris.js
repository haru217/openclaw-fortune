'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getEphemeris, getMoonPhase } = require('../lib/ephemeris');

describe('getEphemeris', () => {
  it('returns data for 2026-01-01', () => {
    const data = getEphemeris('2026-01-01');
    assert.equal(data.date, '2026-01-01');
    assert.equal(data.sunSign, '山羊座');
    assert.equal(data.sunSignEn, 'Capricorn');
    assert.ok(typeof data.moonAge === 'number');
    assert.ok(data.moonPhase);
    assert.ok(data.moonSign);
  });

  it('returns data for 2026-12-31', () => {
    const data = getEphemeris('2026-12-31');
    assert.equal(data.date, '2026-12-31');
  });

  it('returns data for 2026-06-15', () => {
    const data = getEphemeris('2026-06-15');
    assert.equal(data.date, '2026-06-15');
  });

  it('throws for date outside 2026', () => {
    assert.throws(() => getEphemeris('2025-01-01'), /not found/i);
  });

  it('throws for invalid date string', () => {
    assert.throws(() => getEphemeris('not-a-date'), /not found/i);
  });
});

describe('getMoonPhase', () => {
  it('returns moon phase string for 2026-01-01', () => {
    const phase = getMoonPhase('2026-01-01');
    assert.equal(typeof phase, 'string');
    assert.ok(phase.length > 0);
  });

  it('returns same phase as getEphemeris', () => {
    const eph = getEphemeris('2026-03-20');
    const phase = getMoonPhase('2026-03-20');
    assert.equal(phase, eph.moonPhase);
  });

  it('throws for missing date', () => {
    assert.throws(() => getMoonPhase('2025-01-01'), /not found/i);
  });
});
