'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handleEvent } = require('../src/handlers.js');

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

function createMockEnv(kv) {
  return {
    FORTUNE_KV: kv,
    LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
    ASSETS_BASE_URL: 'https://example.com',
  };
}

describe('handleEvent', () => {
  it('follow event returns welcome flex message', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    const event = { type: 'follow', replyToken: 'tok1', source: { userId: 'U1' } };

    const messages = await handleEvent(event, env);

    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'flex');
    assert.ok(messages[0].altText.includes('カイ'));
  });

  it('unregistered user with valid birthday registers and returns flex', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    const event = {
      type: 'message',
      message: { type: 'text', text: '1990/01/15' },
      replyToken: 'tok2',
      source: { userId: 'U2' },
    };

    const messages = await handleEvent(event, env);

    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'flex');
    const user = await kv.get('user:U2', { type: 'json' });
    assert.equal(user.sign, 'capricorn');
  });

  it('unregistered user with invalid text re-shows welcome', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    const event = {
      type: 'message',
      message: { type: 'text', text: 'こんにちは' },
      replyToken: 'tok3',
      source: { userId: 'U3' },
    };

    const messages = await handleEvent(event, env);

    assert.equal(messages[0].type, 'flex');
    const user = await kv.get('user:U3', { type: 'json' });
    assert.equal(user, null);
  });

  it('registered user saying 今日の占い gets fortune card', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    const today = new Date().toISOString().slice(0, 10);

    await kv.put('user:U4', JSON.stringify({
      sign: 'aries',
      birthday: '1990-04-01',
      registered_at: '2026-01-01',
      view_count: 0,
    }));

    await kv.put(`daily:${today}`, JSON.stringify({
      fortunes: {
        aries: {
          sign: '牡羊座',
          message: 'good day',
          card: { id: 0, name: '愚者', reversed: false },
        },
      },
    }));

    const event = {
      type: 'message',
      message: { type: 'text', text: '今日の占い' },
      replyToken: 'tok4',
      source: { userId: 'U4' },
    };

    const messages = await handleEvent(event, env);

    assert.equal(messages[0].type, 'flex');
    assert.ok(messages[0].altText.includes('占い'));
  });

  it('registered user saying 個別鑑定 gets paid info', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);

    await kv.put('user:U5', JSON.stringify({
      sign: 'leo',
      birthday: '1990-08-15',
      registered_at: '2026-01-01',
      view_count: 0,
    }));

    const event = {
      type: 'message',
      message: { type: 'text', text: '個別鑑定' },
      replyToken: 'tok5',
      source: { userId: 'U5' },
    };

    const messages = await handleEvent(event, env);

    assert.equal(messages[0].type, 'flex');
    assert.ok(messages[0].altText.includes('鑑定'));
  });

  it('registered user with unknown text gets default message', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);

    await kv.put('user:U6', JSON.stringify({
      sign: 'leo',
      birthday: '1990-08-15',
      registered_at: '2026-01-01',
      view_count: 0,
    }));

    const event = {
      type: 'message',
      message: { type: 'text', text: 'おはよう' },
      replyToken: 'tok6',
      source: { userId: 'U6' },
    };

    const messages = await handleEvent(event, env);

    assert.equal(messages[0].type, 'text');
    assert.ok(messages[0].text.includes('今日の占い'));
  });
});
