'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  dailyKey,
  userKey,
  getDailyFortune,
  getUser,
  saveUser,
  saveDailyFortune,
  incrementViewCount,
} = require('../src/kv.js');

function createMockKV() {
  const store = new Map();
  return {
    get: async (key, opts) => {
      const value = store.get(key);
      if (!value) {
        return null;
      }
      return opts?.type === 'json' ? JSON.parse(value) : value;
    },
    put: async (key, value) => {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    _store: store,
  };
}

describe('key helpers', () => {
  it('dailyKey formats correctly', () => {
    assert.equal(dailyKey('2026-03-20'), 'daily:2026-03-20');
  });

  it('userKey formats correctly', () => {
    assert.equal(userKey('U123'), 'user:U123');
  });
});

describe('getDailyFortune', () => {
  it('returns null when no data', async () => {
    const kv = createMockKV();
    const result = await getDailyFortune(kv, '2026-03-20');
    assert.equal(result, null);
  });

  it('returns stored data', async () => {
    const kv = createMockKV();
    const data = { fortunes: { aries: { sign: '牡羊座', message: 'test' } } };
    await kv.put('daily:2026-03-20', JSON.stringify(data));
    const result = await getDailyFortune(kv, '2026-03-20');
    assert.deepStrictEqual(result, data);
  });

  it('falls back to previous day', async () => {
    const kv = createMockKV();
    const data = { fortunes: { aries: { sign: '牡羊座', message: 'yesterday' } } };
    await kv.put('daily:2026-03-19', JSON.stringify(data));
    const result = await getDailyFortune(kv, '2026-03-20', { fallbackDays: 1 });
    assert.deepStrictEqual(result, data);
  });
});

describe('daily save', () => {
  it('saveDailyFortune stores serialized value', async () => {
    const kv = createMockKV();
    const data = { fortunes: { leo: { sign: '獅子座', message: 'ok' } } };
    await saveDailyFortune(kv, '2026-03-20', data);
    const raw = kv._store.get('daily:2026-03-20');
    assert.equal(raw, JSON.stringify(data));
  });
});

describe('user operations', () => {
  it('getUser returns null for unknown user', async () => {
    const kv = createMockKV();
    const result = await getUser(kv, 'U999');
    assert.equal(result, null);
  });

  it('saveUser and getUser roundtrip', async () => {
    const kv = createMockKV();
    await saveUser(kv, 'U123', { sign: 'leo', birthday: '1990-01-15' });
    const user = await getUser(kv, 'U123');
    assert.equal(user.sign, 'leo');
    assert.equal(user.birthday, '1990-01-15');
    assert.equal(user.view_count, 0);
    assert.ok(user.registered_at);
  });

  it('incrementViewCount increments correctly', async () => {
    const kv = createMockKV();
    await saveUser(kv, 'U123', { sign: 'leo', birthday: '1990-01-15' });
    const count = await incrementViewCount(kv, 'U123');
    assert.equal(count, 1);
    const count2 = await incrementViewCount(kv, 'U123');
    assert.equal(count2, 2);
  });

  it('incrementViewCount returns -1 for unknown user', async () => {
    const kv = createMockKV();
    const count = await incrementViewCount(kv, 'U999');
    assert.equal(count, -1);
  });
});
