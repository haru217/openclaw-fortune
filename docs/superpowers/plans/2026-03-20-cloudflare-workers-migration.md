# Cloudflare Workers 移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LINE webhook サーバーを Express (localhost) から Cloudflare Workers に移行し、固定URL・24時間応答を実現する。

**Architecture:** Workers が LINE webhook を受信し、KV からデータを読み書きして LINE Reply API で応答する。LINE Bot SDK は使わず fetch + crypto.subtle で自前実装。PC 側バッチは klaw で占い生成後、Workers API 経由で KV に書き込む。画像は R2 のパブリック URL を使用。

**Tech Stack:** Cloudflare Workers, KV, R2, Wrangler CLI, Node.js (バッチ側)

**Spec:** `docs/superpowers/specs/2026-03-20-cloudflare-workers-migration.md`

---

## File Structure

```
cloudflare-worker/
├── wrangler.toml              # Workers設定（KVバインディング、環境変数）
├── package.json               # wrangler devDependency
├── src/
│   ├── index.js               # エントリポイント（ルーティング）
│   ├── line.js                # LINE署名検証 + Reply API呼び出し
│   ├── handlers.js            # イベントハンドラ（follow, message処理）
│   ├── kv.js                  # KV読み書きヘルパー
│   └── flex-messages.js       # Flex Messageビルダー（lib/から移植）
└── test/
    ├── line.test.js           # 署名検証テスト
    ├── handlers.test.js       # ハンドラテスト
    ├── kv.test.js             # KVヘルパーテスト
    └── flex-messages.test.js  # Flexメッセージテスト

scripts/fortune/
├── batch-fortune.js           # 修正: 出力先をWorkers APIに変更
└── upload-assets.js           # 新規: 画像をR2にアップロード
```

---

### Task 1: Workers プロジェクト初期設定

**Files:**
- Create: `cloudflare-worker/wrangler.toml`
- Create: `cloudflare-worker/package.json`

- [ ] **Step 1: wrangler.toml を作成**

```toml
name = "openclaw-fortune"
main = "src/index.js"
compatibility_date = "2026-03-20"
workers_dev = true

[[kv_namespaces]]
binding = "FORTUNE_KV"
id = "__FILL_AFTER_CREATE__"

# R2は画像のパブリックURL直指定のため、バインディング不要

[vars]
# 非機密設定はここに書ける
# LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, API_KEY は wrangler secret put で設定
```

- [ ] **Step 2: package.json を作成**

```json
{
  "name": "openclaw-fortune-worker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "node --test test/*.test.js"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add cloudflare-worker/wrangler.toml cloudflare-worker/package.json
git commit -m "chore: Workers プロジェクト初期設定（wrangler.toml, package.json）"
```

---

### Task 2: LINE 署名検証 + Reply API モジュール

**Files:**
- Create: `cloudflare-worker/src/line.js`
- Create: `cloudflare-worker/test/line.test.js`

- [ ] **Step 1: テストを書く**

```js
// cloudflare-worker/test/line.test.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { verifySignature, buildReplyBody } = require('../src/line.js');

describe('verifySignature', () => {
  const SECRET = 'test-channel-secret';

  it('returns true for valid signature', async () => {
    const body = '{"events":[]}';
    // Pre-compute expected HMAC-SHA256 base64 for this body+secret
    const crypto = require('node:crypto');
    const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64');
    const result = await verifySignature(body, expected, SECRET);
    assert.equal(result, true);
  });

  it('returns false for invalid signature', async () => {
    const body = '{"events":[]}';
    const result = await verifySignature(body, 'invalid-signature', SECRET);
    assert.equal(result, false);
  });

  it('returns false for tampered body', async () => {
    const body = '{"events":[]}';
    const crypto = require('node:crypto');
    const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64');
    const result = await verifySignature('{"events":[{"type":"follow"}]}', sig, SECRET);
    assert.equal(result, false);
  });
});

describe('buildReplyBody', () => {
  it('builds correct JSON structure', () => {
    const result = buildReplyBody('token123', [{ type: 'text', text: 'hello' }]);
    assert.deepStrictEqual(result, {
      replyToken: 'token123',
      messages: [{ type: 'text', text: 'hello' }],
    });
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
cd cloudflare-worker && node --test test/line.test.js
```

Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: line.js を実装**

```js
// cloudflare-worker/src/line.js
'use strict';

/**
 * LINE webhook署名検証（crypto.subtle使用 — Edge Runtime互換）
 * Node.js環境ではglobalThis.cryptoが利用可能（Node 20+）
 */
async function verifySignature(body, signature, channelSecret) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return expected === signature;
  } catch {
    return false;
  }
}

/**
 * LINE Reply API 呼び出し
 */
async function replyMessage(replyToken, messages, channelAccessToken) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('[line] Reply API error:', res.status, text);
  }
  return res;
}

/**
 * Reply APIリクエストボディを構築
 */
function buildReplyBody(replyToken, messages) {
  return { replyToken, messages };
}

module.exports = { verifySignature, replyMessage, buildReplyBody };
```

- [ ] **Step 4: テスト実行 → パスを確認**

```bash
cd cloudflare-worker && node --test test/line.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/line.js cloudflare-worker/test/line.test.js
git commit -m "feat: LINE署名検証+Reply APIモジュール（crypto.subtle）"
```

---

### Task 3: KV ヘルパーモジュール

**Files:**
- Create: `cloudflare-worker/src/kv.js`
- Create: `cloudflare-worker/test/kv.test.js`

- [ ] **Step 1: テストを書く**

```js
// cloudflare-worker/test/kv.test.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { dailyKey, userKey, getDailyFortune, getUser, saveUser, saveDailyFortune, incrementViewCount } = require('../src/kv.js');

// Mock KV namespace
function createMockKV() {
  const store = new Map();
  return {
    get: async (key, opts) => {
      const val = store.get(key);
      if (!val) return null;
      return opts?.type === 'json' ? JSON.parse(val) : val;
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
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
cd cloudflare-worker && node --test test/kv.test.js
```

- [ ] **Step 3: kv.js を実装**

```js
// cloudflare-worker/src/kv.js
'use strict';

function dailyKey(date) {
  return `daily:${date}`;
}

function userKey(userId) {
  return `user:${userId}`;
}

async function getDailyFortune(kv, date, options = {}) {
  const { fallbackDays = 0 } = options;
  const data = await kv.get(dailyKey(date), { type: 'json' });
  if (data) return data;

  if (fallbackDays > 0) {
    const prev = new Date(date + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    const prevDate = prev.toISOString().slice(0, 10);
    return kv.get(dailyKey(prevDate), { type: 'json' });
  }
  return null;
}

async function saveDailyFortune(kv, date, data) {
  await kv.put(dailyKey(date), JSON.stringify(data));
}

async function getUser(kv, userId) {
  return kv.get(userKey(userId), { type: 'json' });
}

async function saveUser(kv, userId, { sign, birthday }) {
  const user = {
    sign,
    birthday,
    registered_at: new Date().toISOString(),
    view_count: 0,
  };
  await kv.put(userKey(userId), JSON.stringify(user));
  return user;
}

async function incrementViewCount(kv, userId) {
  const user = await getUser(kv, userId);
  if (!user) return -1;
  user.view_count = (user.view_count ?? 0) + 1;
  await kv.put(userKey(userId), JSON.stringify(user));
  return user.view_count;
}

module.exports = { dailyKey, userKey, getDailyFortune, saveDailyFortune, getUser, saveUser, incrementViewCount };
```

- [ ] **Step 4: テスト実行 → パスを確認**

```bash
cd cloudflare-worker && node --test test/kv.test.js
```

- [ ] **Step 5: Commit**

```bash
git add cloudflare-worker/src/kv.js cloudflare-worker/test/kv.test.js
git commit -m "feat: KVヘルパーモジュール（日次占い+ユーザーデータ）"
```

---

### Task 4: Flex Message ビルダー移植

**Files:**
- Create: `cloudflare-worker/src/flex-messages.js`
- Create: `cloudflare-worker/test/flex-messages.test.js`

- [ ] **Step 1: lib/flex-messages.js をコピーして調整**

現行の `lib/flex-messages.js` をそのまま `cloudflare-worker/src/flex-messages.js` にコピーする。変更点はなし — `baseUrl` パラメータで画像URLのベースを受け取る設計は Workers でもそのまま使える（R2 のパブリック URL を渡す）。

- [ ] **Step 2: テストもコピー**

現行の `tests/test_flex_messages.js` を `cloudflare-worker/test/flex-messages.test.js` にコピー。require パスを `../src/flex-messages.js` に変更。

- [ ] **Step 3: テスト実行 → パスを確認**

```bash
cd cloudflare-worker && node --test test/flex-messages.test.js
```

- [ ] **Step 4: Commit**

```bash
git add cloudflare-worker/src/flex-messages.js cloudflare-worker/test/flex-messages.test.js
git commit -m "feat: Flex Messageビルダー移植（lib/からWorkers側へ）"
```

---

### Task 5: イベントハンドラ

**Files:**
- Create: `cloudflare-worker/src/handlers.js`
- Create: `cloudflare-worker/test/handlers.test.js`

- [ ] **Step 1: テストを書く**

```js
// cloudflare-worker/test/handlers.test.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { handleEvent } = require('../src/handlers.js');

// 現行 server.js のロジックと同等の動作を検証:
// - follow → ウェルカムカード
// - 未登録ユーザーのテキスト → 生年月日パース → 登録
// - 登録済み「今日の占い」 → 占いカード返却
// - 登録済み「個別鑑定」 → 有料鑑定情報
// - その他テキスト → デフォルトメッセージ

function createMockKV() {
  const store = new Map();
  return {
    get: async (key, opts) => {
      const val = store.get(key);
      if (!val) return null;
      return opts?.type === 'json' ? JSON.parse(val) : val;
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
      type: 'message', message: { type: 'text', text: '1990/01/15' },
      replyToken: 'tok2', source: { userId: 'U2' },
    };
    const messages = await handleEvent(event, env);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'flex');
    // User should be saved in KV
    const user = await kv.get('user:U2', { type: 'json' });
    assert.equal(user.sign, 'capricorn');
  });

  it('unregistered user with invalid text re-shows welcome', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    const event = {
      type: 'message', message: { type: 'text', text: 'こんにちは' },
      replyToken: 'tok3', source: { userId: 'U3' },
    };
    const messages = await handleEvent(event, env);
    assert.equal(messages[0].type, 'flex');
    // User should NOT be saved
    const user = await kv.get('user:U3', { type: 'json' });
    assert.equal(user, null);
  });

  it('registered user saying 今日の占い gets fortune card', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    // Pre-register user
    await kv.put('user:U4', JSON.stringify({ sign: 'aries', birthday: '1990-04-01', registered_at: '2026-01-01', view_count: 0 }));
    // Pre-load daily fortune
    await kv.put('daily:' + new Date().toISOString().slice(0, 10), JSON.stringify({
      fortunes: { aries: { sign: '牡羊座', message: 'good day', card: { id: 0, name: '愚者', reversed: false } } },
    }));
    const event = {
      type: 'message', message: { type: 'text', text: '今日の占い' },
      replyToken: 'tok4', source: { userId: 'U4' },
    };
    const messages = await handleEvent(event, env);
    assert.equal(messages[0].type, 'flex');
    assert.ok(messages[0].altText.includes('占い'));
  });

  it('registered user saying 個別鑑定 gets paid info', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    await kv.put('user:U5', JSON.stringify({ sign: 'leo', birthday: '1990-08-15', registered_at: '2026-01-01', view_count: 0 }));
    const event = {
      type: 'message', message: { type: 'text', text: '個別鑑定' },
      replyToken: 'tok5', source: { userId: 'U5' },
    };
    const messages = await handleEvent(event, env);
    assert.equal(messages[0].type, 'flex');
    assert.ok(messages[0].altText.includes('鑑定'));
  });

  it('registered user with unknown text gets default message', async () => {
    const kv = createMockKV();
    const env = createMockEnv(kv);
    await kv.put('user:U6', JSON.stringify({ sign: 'leo', birthday: '1990-08-15', registered_at: '2026-01-01', view_count: 0 }));
    const event = {
      type: 'message', message: { type: 'text', text: 'おはよう' },
      replyToken: 'tok6', source: { userId: 'U6' },
    };
    const messages = await handleEvent(event, env);
    assert.equal(messages[0].type, 'text');
    assert.ok(messages[0].text.includes('今日の占い'));
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
cd cloudflare-worker && node --test test/handlers.test.js
```

- [ ] **Step 3: handlers.js を実装**

`handlers.js` は現行 `scripts/fortune/server.js` のハンドラロジックを移植する。違い:
- KV を使う（ファイル I/O の代わり）
- `replyMessage()` は呼ばず、メッセージ配列を返す（呼び出し側で Reply API を叩く）
- `getZodiacSignFromBirthday` は `lib/zodiac.js` からコピーして同梱する必要がある（Workers は Node require が使えないため）

**重要:** `lib/zodiac.js` の `getZodiacSignFromBirthday`, `ZODIAC_SIGNS`, `parseMonthDay` を `cloudflare-worker/src/zodiac.js` としてコピーする。

```js
// cloudflare-worker/src/handlers.js
'use strict';

const { getZodiacSignFromBirthday } = require('./zodiac.js');
const { getUser, saveUser, getDailyFortune, incrementViewCount } = require('./kv.js');
const {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
  buildPaidReadingInfo,
} = require('./flex-messages.js');

/**
 * イベントを処理し、返信メッセージ配列を返す。
 * Reply API の呼び出しは呼び出し側（index.js）が行う。
 */
async function handleEvent(event, env) {
  const kv = env.FORTUNE_KV;
  const baseUrl = env.ASSETS_BASE_URL || '';

  if (event.type === 'follow') {
    return [{
      type: 'flex',
      altText: 'はじめまして、カイです。あなたの星を読みます。',
      contents: buildWelcomeCard(baseUrl),
    }];
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return [];
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();
  const user = await getUser(kv, userId);

  if (!user) {
    return handleRegistration(kv, baseUrl, text, userId);
  }

  if (text === '今日の占い' || text === '占い') {
    return handleDailyFortune(kv, baseUrl, userId, user);
  }

  if (text === '個別鑑定') {
    return [{
      type: 'flex',
      altText: '個別タロット鑑定のご案内',
      contents: buildPaidReadingInfo(),
    }];
  }

  return [{ type: 'text', text: 'メニューの「今日の占い」からいつでも占いが見れます。ぜひどうぞ' }];
}

async function handleRegistration(kv, baseUrl, text, userId) {
  try {
    const result = getZodiacSignFromBirthday(text);
    await saveUser(kv, userId, { sign: result.id, birthday: result.birthday });
    const today = new Date().toISOString().slice(0, 10);
    const data = await getDailyFortune(kv, today, { fallbackDays: 1 });
    const fortune = data && data.fortunes[result.id];
    const fortuneText = fortune ? fortune.message : '明日から毎日の占いをお届けします。お楽しみに';
    return [{
      type: 'flex',
      altText: `${result.name}で登録しました。今日の占いをお届けします。`,
      contents: buildRegistrationCompleteCard(result.name, fortuneText, baseUrl),
    }];
  } catch (err) {
    console.error('[handleRegistration]', err.message);
    return [{
      type: 'flex',
      altText: 'カイです。生年月日を教えてください。',
      contents: buildWelcomeCard(baseUrl),
    }];
  }
}

async function handleDailyFortune(kv, baseUrl, userId, user) {
  const today = new Date().toISOString().slice(0, 10);
  const data = await getDailyFortune(kv, today, { fallbackDays: 1 });
  if (!data || !data.fortunes[user.sign]) {
    return [{ type: 'text', text: '本日の占いは準備中です。もう少しお待ちください' }];
  }
  const fortune = data.fortunes[user.sign];
  const viewCount = await incrementViewCount(kv, userId);
  const isPromoTime = viewCount > 0 && viewCount % 3 === 0;
  const card = isPromoTime
    ? buildFortuneCardWithPromo(fortune, baseUrl)
    : buildFortuneCard(fortune, baseUrl);
  return [{
    type: 'flex',
    altText: `${fortune.sign}の今日の占い`,
    contents: card,
  }];
}

module.exports = { handleEvent };
```

- [ ] **Step 4: zodiac.js をコピー**

`lib/zodiac.js` を `cloudflare-worker/src/zodiac.js` にそのままコピーする。

- [ ] **Step 5: テスト実行 → パスを確認**

```bash
cd cloudflare-worker && node --test test/handlers.test.js
```

- [ ] **Step 6: Commit**

```bash
git add cloudflare-worker/src/handlers.js cloudflare-worker/src/zodiac.js cloudflare-worker/test/handlers.test.js
git commit -m "feat: イベントハンドラ実装（follow/登録/占い/個別鑑定）"
```

---

### Task 6: Workers エントリポイント（ルーティング）

**Files:**
- Create: `cloudflare-worker/src/index.js`

- [ ] **Step 1: index.js を実装**

```js
// cloudflare-worker/src/index.js
'use strict';

const { verifySignature, replyMessage } = require('./line.js');
const { handleEvent } = require('./handlers.js');
const { saveDailyFortune } = require('./kv.js');

module.exports = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok' });
    }

    // LINE webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }

    // バッチからの日次占いデータ書き込み
    if (url.pathname === '/api/daily' && request.method === 'POST') {
      return handleDailyUpload(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleWebhook(request, env) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  const valid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const data = JSON.parse(body);
  const events = data.events || [];

  for (const event of events) {
    try {
      const messages = await handleEvent(event, env);
      if (messages.length > 0 && event.replyToken) {
        await replyMessage(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
      }
    } catch (err) {
      console.error('[webhook] Event error:', err.message);
    }
  }

  return Response.json({ ok: true });
}

async function handleDailyUpload(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const data = await request.json();
  if (!data.date || !data.fortunes) {
    return Response.json({ error: 'date and fortunes required' }, { status: 400 });
  }

  await saveDailyFortune(env.FORTUNE_KV, data.date, {
    fortunes: data.fortunes,
    generated_at: new Date().toISOString(),
  });

  return Response.json({ ok: true, date: data.date });
}
```

- [ ] **Step 2: Commit**

```bash
git add cloudflare-worker/src/index.js
git commit -m "feat: Workersエントリポイント（webhook/api/daily/health）"
```

---

### Task 7: バッチスクリプト修正（Workers API 出力）

**Files:**
- Modify: `scripts/fortune/batch-fortune.js`

- [ ] **Step 1: バッチスクリプトの出力部分を修正**

現行の `saveDailyFortune(DAILY_DIR, today, allFortunes)` の後に、Workers API への送信を追加する。ローカル保存も残す（バックアップ）。

スクリプト末尾に以下を追加:

```js
// Workers API への送信
const WORKER_URL = process.env.WORKER_URL;
const API_KEY = process.env.API_KEY;

if (WORKER_URL && API_KEY) {
  console.log('[batch] Uploading to Workers...');
  try {
    const res = await fetch(`${WORKER_URL}/api/daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
      },
      body: JSON.stringify({ date: today, fortunes: allFortunes }),
    });
    const result = await res.json();
    console.log('[batch] Workers upload:', result.ok ? 'OK' : 'FAILED', result);
  } catch (err) {
    console.error('[batch] Workers upload error:', err.message);
  }
} else {
  console.log('[batch] WORKER_URL or API_KEY not set, skipping Workers upload');
}
```

**注意:** `batch-fortune.js` は現在 CommonJS で同期的に書かれている部分がある。`fetch` は Node 20+ でグローバル利用可能。ただし top-level await が使えないため、main 関数内に追加する。

- [ ] **Step 2: .env にWorkers変数を追加**

`.env` に以下を追記（Workers デプロイ後に実際の値を設定）:

```
WORKER_URL=https://openclaw-fortune.xxx.workers.dev
API_KEY=your-api-key-here
```

- [ ] **Step 3: Commit**

```bash
git add scripts/fortune/batch-fortune.js
git commit -m "feat: バッチスクリプトにWorkers APIアップロード追加"
```

---

### Task 8: 画像アップロードスクリプト

**Files:**
- Create: `scripts/fortune/upload-assets.js`

- [ ] **Step 1: upload-assets.js を作成**

```js
// scripts/fortune/upload-assets.js
'use strict';

// R2 への画像アップロードは wrangler r2 object put で行う。
// このスクリプトは assets/ 内の全画像を R2 バケットにアップロードする。

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const BUCKET_NAME = 'openclaw-fortune-assets';

function uploadFile(localPath, remotePath) {
  console.log(`[upload] ${remotePath}`);
  execSync(
    `wrangler r2 object put "${BUCKET_NAME}/${remotePath}" --file="${localPath}"`,
    { stdio: 'inherit' }
  );
}

function main() {
  // タロット画像
  const tarotDir = path.join(ASSETS_DIR, 'tarot');
  if (fs.existsSync(tarotDir)) {
    const files = fs.readdirSync(tarotDir).filter(f => f.endsWith('.jpg'));
    for (const file of files) {
      uploadFile(path.join(tarotDir, file), `tarot/${file}`);
    }
  }

  // プロフィール・ウェルカム画像
  for (const file of ['profile-icon.jpg', 'welcome-hero.jpg']) {
    const filePath = path.join(ASSETS_DIR, file);
    if (fs.existsSync(filePath)) {
      uploadFile(filePath, file);
    }
  }

  console.log('[upload] Done.');
}

main();
```

- [ ] **Step 2: package.json にスクリプト追加**

`package.json` の scripts に追加:

```json
"upload-assets": "node scripts/fortune/upload-assets.js"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/fortune/upload-assets.js package.json
git commit -m "feat: R2画像アップロードスクリプト"
```

---

### Task 9: デプロイ・設定（手動ステップ）

このタスクはコードではなく手動操作。

- [ ] **Step 1: Cloudflare ダッシュボードで KV namespace 作成**

```bash
cd cloudflare-worker
npx wrangler kv namespace create FORTUNE_KV
```

出力される `id` を `wrangler.toml` の `id` フィールドに設定。

- [ ] **Step 2: R2 バケット作成**

```bash
npx wrangler r2 bucket create openclaw-fortune-assets
```

R2 パブリックアクセスを有効化（Cloudflare ダッシュボードから）。

- [ ] **Step 3: Secrets 設定**

```bash
cd cloudflare-worker
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put API_KEY
```

- [ ] **Step 4: wrangler.toml に ASSETS_BASE_URL を設定**

R2 のパブリック URL が確定したら `[vars]` に追加:

```toml
[vars]
ASSETS_BASE_URL = "https://pub-xxxx.r2.dev"
```

- [ ] **Step 5: 画像アップロード**

```bash
npm run upload-assets
```

- [ ] **Step 6: Workers デプロイ**

```bash
cd cloudflare-worker
npm install
npx wrangler deploy
```

デプロイ後の URL（例: `https://openclaw-fortune.xxx.workers.dev`）を `.env` の `WORKER_URL` に設定。

- [ ] **Step 7: LINE webhook URL 変更**

LINE Official Account Manager → 設定 → Messaging API → Webhook URL を Workers の URL に変更:
`https://openclaw-fortune.xxx.workers.dev/webhook`

- [ ] **Step 8: バッチ実行テスト**

```bash
node scripts/fortune/batch-fortune.js
```

Workers の KV にデータが入ったか確認。

- [ ] **Step 9: E2E テスト**

LINE で以下を確認:
1. ブロック → 再追加 → ウェルカムカード表示
2. 生年月日入力 → 登録完了+初回占い
3. リッチメニュー「今日の占い」→ 占いカード表示
4. リッチメニュー「個別鑑定」→ 有料鑑定情報表示

- [ ] **Step 10: Windows タスクスケジューラ設定**

毎朝7:00にバッチ実行:
```
プログラム: node
引数: C:\Users\senta\openclaw-fortune\scripts\fortune\batch-fortune.js
開始: C:\Users\senta\openclaw-fortune
```

- [ ] **Step 11: cloudflared / Express サーバー廃止**

Workers が安定動作を確認後、cloudflared プロセスと Express サーバーを停止。

- [ ] **Step 12: Commit & Push**

```bash
git add cloudflare-worker/wrangler.toml .env
git commit -m "chore: Workers デプロイ設定完了（KV/R2/Secrets）"
git push origin master
```
