const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { saveDailyFortune, loadDailyFortune } = require('../lib/daily-fortune');

const TEST_DIR = path.join(__dirname, 'tmp_daily');

describe('daily-fortune', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('saveDailyFortune creates directory and file', () => {
    const fortunes = {
      aries: { sign: '牡羊座', message: 'test', lucky_item: 'pen', card: { id: 0, name: '愚者', reversed: false } },
    };
    saveDailyFortune(TEST_DIR, '2026-03-20', fortunes);

    const filePath = path.join(TEST_DIR, '2026-03-20.json');
    assert.ok(fs.existsSync(filePath));
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(data.date, '2026-03-20');
    assert.equal(data.fortunes.aries.sign, '牡羊座');
    assert.ok(data.generated_at);
  });

  it('loadDailyFortune reads saved data', () => {
    const fortunes = {
      aries: { sign: '牡羊座', message: 'test', lucky_item: 'pen', card: { id: 0, name: '愚者', reversed: false } },
    };
    saveDailyFortune(TEST_DIR, '2026-03-20', fortunes);

    const data = loadDailyFortune(TEST_DIR, '2026-03-20');
    assert.equal(data.fortunes.aries.message, 'test');
  });

  it('loadDailyFortune returns null for missing date', () => {
    const data = loadDailyFortune(TEST_DIR, '2026-01-01');
    assert.equal(data, null);
  });

  it('loadDailyFortune falls back to previous day', () => {
    const fortunes = { aries: { sign: '牡羊座', message: 'yesterday', lucky_item: 'pen', card: { id: 0, name: '愚者', reversed: false } } };
    saveDailyFortune(TEST_DIR, '2026-03-19', fortunes);

    const data = loadDailyFortune(TEST_DIR, '2026-03-20', { fallbackDays: 1 });
    assert.equal(data.fortunes.aries.message, 'yesterday');
    assert.equal(data.date, '2026-03-19');
  });
});
