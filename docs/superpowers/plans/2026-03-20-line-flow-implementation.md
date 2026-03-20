# LINE導線改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LINE公式アカウントの導線をマーケター視点で改善（ウェルカム、Flex Card、有料誘導、リッチメニュー）

**Architecture:** 既存のserver.jsにfollow/個別鑑定ハンドラーを追加。Flex Messageテンプレートをlib/flex-messages.jsに分離。users.jsにview_count追加。

**Tech Stack:** Node.js, Express, @line/bot-sdk, LINE Messaging API (Flex Message, Rich Menu API)

---

## Step 1: `lib/users.js` に `view_count` サポート追加

### 1-1. テスト追加（`tests/test_users.js`）

- [ ] `tests/test_users.js` に以下のテストを追加:

```js
// ファイル: tests/test_users.js（既存ファイルの末尾、describeブロック内に追加）

  it('saveUser initializes view_count to 0', () => {
    saveUser(TEST_PATH, 'U_VC1', { sign: 'aries', birthday: '1990-03-25' });
    const user = getUser(TEST_PATH, 'U_VC1');
    assert.equal(user.view_count, 0);
  });

  it('incrementViewCount increments from 0 to 1', () => {
    saveUser(TEST_PATH, 'U_VC2', { sign: 'aries', birthday: '1990-03-25' });
    const count = incrementViewCount(TEST_PATH, 'U_VC2');
    assert.equal(count, 1);
    const user = getUser(TEST_PATH, 'U_VC2');
    assert.equal(user.view_count, 1);
  });

  it('incrementViewCount increments multiple times', () => {
    saveUser(TEST_PATH, 'U_VC3', { sign: 'aries', birthday: '1990-03-25' });
    incrementViewCount(TEST_PATH, 'U_VC3');
    incrementViewCount(TEST_PATH, 'U_VC3');
    const count = incrementViewCount(TEST_PATH, 'U_VC3');
    assert.equal(count, 3);
  });

  it('incrementViewCount handles legacy user without view_count', () => {
    // レガシーユーザー（view_countフィールドなし）のシミュレーション
    const users = { 'U_LEGACY': { sign: 'taurus', birthday: null, registered_at: '2026-01-01T00:00:00Z' } };
    fs.writeFileSync(TEST_PATH, JSON.stringify(users, null, 2), 'utf8');
    const count = incrementViewCount(TEST_PATH, 'U_LEGACY');
    assert.equal(count, 1);
  });

  it('incrementViewCount returns -1 for unknown user', () => {
    const count = incrementViewCount(TEST_PATH, 'U_NONEXIST');
    assert.equal(count, -1);
  });
```

- [ ] import行を更新:

```js
// 変更前
const { loadUsers, saveUser, getUser } = require('../lib/users');

// 変更後
const { loadUsers, saveUser, getUser, incrementViewCount } = require('../lib/users');
```

- [ ] テスト実行（失敗を確認）:

```bash
node --test tests/test_users.js
# 期待: 新規テスト5件がFAIL（incrementViewCountが未定義）
```

### 1-2. 実装（`lib/users.js`）

- [ ] `saveUser` に `view_count: 0` を追加:

```js
// ファイル: lib/users.js
// 変更前
function saveUser(filePath, userId, { sign, birthday }) {
  const users = loadUsers(filePath);
  users[userId] = {
    sign,
    birthday: birthday || null,
    registered_at: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
}

// 変更後
function saveUser(filePath, userId, { sign, birthday }) {
  const users = loadUsers(filePath);
  users[userId] = {
    sign,
    birthday: birthday || null,
    registered_at: new Date().toISOString(),
    view_count: 0,
  };
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
}
```

- [ ] `incrementViewCount` 関数を追加:

```js
// ファイル: lib/users.js（module.exportsの前に追加）

function incrementViewCount(filePath, userId) {
  const users = loadUsers(filePath);
  if (!users[userId]) return -1;

  // レガシーユーザー対応: view_countがない場合は0として扱う
  const current = users[userId].view_count || 0;
  users[userId].view_count = current + 1;
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
  return users[userId].view_count;
}
```

- [ ] `module.exports` を更新:

```js
// 変更前
module.exports = { loadUsers, saveUser, getUser };

// 変更後
module.exports = { loadUsers, saveUser, getUser, incrementViewCount };
```

- [ ] テスト実行（全件パスを確認）:

```bash
node --test tests/test_users.js
# 期待: 全テスト（既存5 + 新規5 = 10件）PASS
```

### コミットメッセージ

```
feat: users.jsにview_countサポート追加

占い閲覧回数をトラッキングして有料鑑定誘導のタイミング制御に使う

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 2: Flex Messageテンプレートモジュール作成

### 2-1. テスト作成（`tests/test_flex_messages.js`）

- [ ] `tests/test_flex_messages.js` を新規作成:

```js
// ファイル: tests/test_flex_messages.js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
  buildPaidReadingInfo,
} = require('../lib/flex-messages');

const BASE_URL = 'https://example.com';

describe('buildWelcomeCard', () => {
  it('returns a valid Flex bubble', () => {
    const card = buildWelcomeCard(BASE_URL);
    assert.equal(card.type, 'bubble');
    assert.ok(card.hero, 'hero section exists');
    assert.ok(card.body, 'body section exists');
  });

  it('hero image URL uses baseUrl', () => {
    const card = buildWelcomeCard(BASE_URL);
    assert.ok(card.hero.url.startsWith(BASE_URL));
  });

  it('body contains introduction text', () => {
    const card = buildWelcomeCard(BASE_URL);
    const texts = card.body.contents.map(c => c.text).filter(Boolean);
    const allText = texts.join(' ');
    assert.ok(allText.includes('カイ'), 'mentions カイ');
    assert.ok(allText.includes('生年月日'), 'asks for birthday');
  });
});

describe('buildRegistrationCompleteCard', () => {
  it('returns a valid Flex bubble', () => {
    const card = buildRegistrationCompleteCard('牡羊座', '今日は良い日です', BASE_URL);
    assert.equal(card.type, 'bubble');
    assert.ok(card.body);
  });

  it('includes sign name in body', () => {
    const card = buildRegistrationCompleteCard('牡羊座', '今日は良い日です', BASE_URL);
    const texts = JSON.stringify(card);
    assert.ok(texts.includes('牡羊座'));
  });

  it('includes fortune message', () => {
    const card = buildRegistrationCompleteCard('牡羊座', 'テスト占い結果', BASE_URL);
    const texts = JSON.stringify(card);
    assert.ok(texts.includes('テスト占い結果'));
  });

  it('includes education text about daily free fortune', () => {
    const card = buildRegistrationCompleteCard('牡羊座', '占いテキスト', BASE_URL);
    const texts = JSON.stringify(card);
    assert.ok(texts.includes('毎日') || texts.includes('無料'));
  });
});

describe('buildFortuneCard', () => {
  const fortune = {
    sign: '牡羊座',
    message: '今日はいい日です',
    lucky_item: '白いハンカチ',
    card: { id: 0, name: '愚者', reversed: false },
  };

  it('returns a valid Flex bubble', () => {
    const card = buildFortuneCard(fortune, BASE_URL);
    assert.equal(card.type, 'bubble');
  });

  it('includes tarot image URL', () => {
    const card = buildFortuneCard(fortune, BASE_URL);
    const json = JSON.stringify(card);
    assert.ok(json.includes('/assets/tarot/'));
  });

  it('includes fortune message text', () => {
    const card = buildFortuneCard(fortune, BASE_URL);
    const json = JSON.stringify(card);
    assert.ok(json.includes('今日はいい日です'));
  });
});

describe('buildFortuneCardWithPromo', () => {
  const fortune = {
    sign: '牡羊座',
    message: '今日はいい日です',
    lucky_item: '白いハンカチ',
    card: { id: 0, name: '愚者', reversed: false },
  };

  it('returns a valid Flex bubble', () => {
    const card = buildFortuneCardWithPromo(fortune, BASE_URL);
    assert.equal(card.type, 'bubble');
  });

  it('includes promo/paid reading text', () => {
    const card = buildFortuneCardWithPromo(fortune, BASE_URL);
    const json = JSON.stringify(card);
    assert.ok(json.includes('個別鑑定') || json.includes('もっと深く'));
  });

  it('includes fortune message like normal card', () => {
    const card = buildFortuneCardWithPromo(fortune, BASE_URL);
    const json = JSON.stringify(card);
    assert.ok(json.includes('今日はいい日です'));
  });
});

describe('buildPaidReadingInfo', () => {
  it('returns a valid Flex bubble', () => {
    const card = buildPaidReadingInfo();
    assert.equal(card.type, 'bubble');
  });

  it('includes pricing information', () => {
    const json = JSON.stringify(buildPaidReadingInfo());
    assert.ok(json.includes('2,000') || json.includes('2000'));
  });

  it('includes description of service', () => {
    const json = JSON.stringify(buildPaidReadingInfo());
    assert.ok(json.includes('占星術') || json.includes('タロット') || json.includes('鑑定'));
  });
});
```

- [ ] テスト実行（失敗を確認）:

```bash
node --test tests/test_flex_messages.js
# 期待: module not foundでFAIL
```

### 2-2. 実装（`lib/flex-messages.js`）

- [ ] `lib/flex-messages.js` を新規作成:

```js
// ファイル: lib/flex-messages.js
'use strict';

// カラースキーム
const DARK_NAVY = '#1a1a2e';
const GOLD = '#c9a84c';
const LIGHT_TEXT = '#e0e0e0';
const MUTED_TEXT = '#999999';
const WHITE = '#ffffff';

// タロット画像ファイル名マッピング（id → ファイル名）
const TAROT_FILES = [
  '00-fool.jpg', '01-magician.jpg', '02-high-priestess.jpg',
  '03-empress.jpg', '04-emperor.jpg', '05-hierophant.jpg',
  '06-lovers.jpg', '07-chariot.jpg', '08-strength.jpg',
  '09-hermit.jpg', '10-wheel-of-fortune.jpg', '11-justice.jpg',
  '12-hanged-man.jpg', '13-death.jpg', '14-temperance.jpg',
  '15-devil.jpg', '16-tower.jpg', '17-star.jpg',
  '18-moon.jpg', '19-sun.jpg', '20-judgement.jpg',
  '21-world.jpg',
];

function tarotImageUrl(baseUrl, cardId) {
  const file = TAROT_FILES[cardId] || TAROT_FILES[0];
  return `${baseUrl}/assets/tarot/${file}`;
}

/**
 * ウェルカムFlex Card（友だち追加時）
 * 星空+タロット画像 + カイの自己紹介 + 生年月日入力お願い
 */
function buildWelcomeCard(baseUrl) {
  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: `${baseUrl}/assets/welcome-hero.jpg`,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'lg',
      backgroundColor: DARK_NAVY,
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: 'カイ｜あなたの星を読みます',
          weight: 'bold',
          size: 'lg',
          color: GOLD,
        },
        {
          type: 'separator',
          color: '#333355',
        },
        {
          type: 'text',
          text: 'はじめまして。\n西洋占星術とタロットで、あなたの今日の星の流れを毎日お届けします。',
          wrap: true,
          size: 'sm',
          color: LIGHT_TEXT,
          lineSpacing: '6px',
        },
        {
          type: 'text',
          text: 'まずは生年月日を教えてください。\nあなたの星座を読み解きます。',
          wrap: true,
          size: 'sm',
          color: LIGHT_TEXT,
          lineSpacing: '6px',
        },
        {
          type: 'text',
          text: '例: 1990/10/23',
          size: 'sm',
          color: MUTED_TEXT,
          margin: 'md',
        },
      ],
    },
    styles: {
      hero: { backgroundColor: DARK_NAVY },
    },
  };
}

/**
 * 登録完了 + 初回占い + 教育テキスト
 */
function buildRegistrationCompleteCard(signName, fortuneMessage, baseUrl) {
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'lg',
      backgroundColor: DARK_NAVY,
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: `${signName}ですね。登録しました`,
          weight: 'bold',
          size: 'md',
          color: GOLD,
        },
        {
          type: 'separator',
          color: '#333355',
        },
        {
          type: 'text',
          text: fortuneMessage,
          wrap: true,
          size: 'sm',
          color: LIGHT_TEXT,
          lineSpacing: '6px',
        },
        {
          type: 'separator',
          color: '#333355',
          margin: 'lg',
        },
        {
          type: 'text',
          text: '毎日リッチメニューから無料で占いが見れます。\nぜひ明日もチェックしてみてください',
          wrap: true,
          size: 'xs',
          color: MUTED_TEXT,
          lineSpacing: '4px',
          margin: 'md',
        },
      ],
    },
  };
}

/**
 * 今日の占いFlex Card（通常版）
 */
function buildFortuneCard(fortune, baseUrl) {
  const cardLabel = fortune.card.reversed
    ? `${fortune.card.name}（逆位置）`
    : `${fortune.card.name}（正位置）`;

  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: tarotImageUrl(baseUrl, fortune.card.id),
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      backgroundColor: DARK_NAVY,
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: `${fortune.sign} — ${cardLabel}`,
          weight: 'bold',
          size: 'md',
          color: GOLD,
        },
        {
          type: 'separator',
          color: '#333355',
        },
        {
          type: 'text',
          text: fortune.message,
          wrap: true,
          size: 'sm',
          color: LIGHT_TEXT,
          lineSpacing: '6px',
        },
      ],
    },
    styles: {
      hero: { backgroundColor: DARK_NAVY },
    },
  };
}

/**
 * 今日の占いFlex Card（有料鑑定誘導付き版）
 * 3回に1回表示する
 */
function buildFortuneCardWithPromo(fortune, baseUrl) {
  const card = buildFortuneCard(fortune, baseUrl);

  // 末尾に控えめな誘導を追加
  card.body.contents.push(
    {
      type: 'separator',
      color: '#333355',
      margin: 'xl',
    },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      contents: [
        {
          type: 'text',
          text: 'もっと深くあなたの星を読み解きたい方へ',
          size: 'xs',
          color: MUTED_TEXT,
          wrap: true,
        },
        {
          type: 'text',
          text: '個別鑑定について見る →',
          size: 'sm',
          color: GOLD,
          margin: 'sm',
          action: {
            type: 'message',
            label: '個別鑑定',
            text: '個別鑑定',
          },
        },
      ],
    }
  );

  return card;
}

/**
 * 個別鑑定説明Flex Message
 */
function buildPaidReadingInfo() {
  return {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'lg',
      backgroundColor: DARK_NAVY,
      paddingAll: '20px',
      contents: [
        {
          type: 'text',
          text: '個別タロット鑑定',
          weight: 'bold',
          size: 'lg',
          color: GOLD,
        },
        {
          type: 'separator',
          color: '#333355',
        },
        {
          type: 'text',
          text: '西洋占星術とタロットを組み合わせた、あなただけの個別鑑定です。',
          wrap: true,
          size: 'sm',
          color: LIGHT_TEXT,
          lineSpacing: '6px',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '鑑定内容', size: 'xs', color: MUTED_TEXT, flex: 3 },
                { type: 'text', text: '星座 × 数秘術 × タロット', size: 'xs', color: LIGHT_TEXT, flex: 7, wrap: true },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '所要時間', size: 'xs', color: MUTED_TEXT, flex: 3 },
                { type: 'text', text: '24時間以内にお届け', size: 'xs', color: LIGHT_TEXT, flex: 7 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '料金', size: 'xs', color: MUTED_TEXT, flex: 3 },
                { type: 'text', text: '2,000円', size: 'xs', color: GOLD, flex: 7, weight: 'bold' },
              ],
            },
          ],
        },
        {
          type: 'separator',
          color: '#333355',
          margin: 'lg',
        },
        {
          type: 'text',
          text: '決済リンクは準備中です。もうしばらくお待ちください。',
          size: 'xs',
          color: MUTED_TEXT,
          wrap: true,
          margin: 'md',
        },
      ],
    },
  };
}

module.exports = {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
  buildPaidReadingInfo,
};
```

- [ ] テスト実行（全件パスを確認）:

```bash
node --test tests/test_flex_messages.js
# 期待: 全15テストPASS
```

### コミットメッセージ

```
feat: Flex Messageテンプレートモジュール追加

LINE導線用のウェルカム・占い・有料鑑定誘導のFlex Card生成関数を実装

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 3: `scripts/fortune/server.js` の改修

### 3-1. import追加

- [ ] 先頭のrequire群を更新:

```js
// 変更前
const { getUser, saveUser } = require('../../lib/users');

// 変更後
const { getUser, saveUser, incrementViewCount } = require('../../lib/users');
const {
  buildWelcomeCard,
  buildRegistrationCompleteCard,
  buildFortuneCard,
  buildFortuneCardWithPromo,
  buildPaidReadingInfo,
} = require('../../lib/flex-messages');
```

### 3-2. `BASE_URL` 定数を先頭に移動

- [ ] `BASE_URL` はファイル後半で定義されているが、`handleRegistration` でFlex Message内のURL生成に使うため先頭（`USERS_PATH` の後）に移動:

```js
// 追加位置: USERS_PATH定義の直後
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
```

- [ ] ファイル末尾の `const BASE_URL = ...` 行を削除

### 3-3. `handleEvent` 関数の改修

- [ ] `handleEvent` を以下に置き換え:

```js
async function handleEvent(event) {
  // followイベント（友だち追加）
  if (event.type === 'follow') {
    return handleFollow(event);
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();

  // 未登録ユーザー → 登録フロー
  const user = getUser(USERS_PATH, userId);
  if (!user) {
    return handleRegistration(event, userId, text);
  }

  // 登録済み: 「今日の占い」
  if (text === '今日の占い' || text === '占い') {
    return handleDailyFortune(event, userId, user);
  }

  // 登録済み: 「個別鑑定」
  if (text === '個別鑑定') {
    return handlePaidReading(event);
  }

  // デフォルト: リッチメニューへの誘導
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: 'メニューの「今日の占い」からいつでも占いが見れます。ぜひどうぞ',
    }],
  });
}
```

### 3-4. `handleFollow` 関数追加

- [ ] `handleEvent` の後に追加:

```js
async function handleFollow(event) {
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: 'はじめまして、カイです。あなたの星を読みます。',
      contents: buildWelcomeCard(BASE_URL),
    }],
  });
}
```

### 3-5. `handleRegistration` 関数の改修

- [ ] 登録成功時に初回占いも即配信するように変更:

```js
async function handleRegistration(event, userId, text) {
  try {
    const result = getZodiacSignFromBirthday(text);
    saveUser(USERS_PATH, userId, { sign: result.id, birthday: result.birthday });

    // 初回占いを取得して一緒に配信
    const today = new Date().toISOString().slice(0, 10);
    const data = loadDailyFortune(DAILY_DIR, today, { fallbackDays: 1 });
    const fortune = data && data.fortunes[result.id];
    const fortuneText = fortune
      ? fortune.message
      : '明日から毎日の占いをお届けします。お楽しみに';

    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'flex',
        altText: `${result.name}で登録しました。今日の占いをお届けします。`,
        contents: buildRegistrationCompleteCard(result.name, fortuneText, BASE_URL),
      }],
    });
  } catch (_) {
    // 生年月日パース失敗 → ウェルカムカードで再入力案内
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'flex',
        altText: 'カイです。生年月日を教えてください。',
        contents: buildWelcomeCard(BASE_URL),
      }],
    });
  }
}
```

### 3-6. `handleDailyFortune` 関数の改修

- [ ] view_countインクリメント + 3回に1回Promo付きに変更:

```js
// 変更前: handleDailyFortune(event, user)
// 変更後: handleDailyFortune(event, userId, user)

async function handleDailyFortune(event, userId, user) {
  const today = new Date().toISOString().slice(0, 10);
  const data = loadDailyFortune(DAILY_DIR, today, { fallbackDays: 1 });

  if (!data || !data.fortunes[user.sign]) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '本日の占いは準備中です。もう少しお待ちください' }],
    });
  }

  const fortune = data.fortunes[user.sign];

  // view_countインクリメント
  const viewCount = incrementViewCount(USERS_PATH, userId);

  // 3回に1回は有料鑑定誘導付き
  const isPromoTime = viewCount > 0 && viewCount % 3 === 0;
  const card = isPromoTime
    ? buildFortuneCardWithPromo(fortune, BASE_URL)
    : buildFortuneCard(fortune, BASE_URL);

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: `${fortune.sign}の今日の占い`,
      contents: card,
    }],
  });
}
```

### 3-7. `handlePaidReading` 関数追加

- [ ] `handleDailyFortune` の後に追加:

```js
async function handlePaidReading(event) {
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'flex',
      altText: '個別タロット鑑定のご案内',
      contents: buildPaidReadingInfo(),
    }],
  });
}
```

### 3-8. 動作確認

- [ ] server.js の構文チェック:

```bash
node -c scripts/fortune/server.js
# 期待: 出力なし（構文エラーなし）
```

- [ ] 全テスト実行:

```bash
npm test
# 期待: 全テスト PASS
```

### コミットメッセージ

```
feat: server.jsにfollow/個別鑑定/Flex Card対応を追加

- followイベントでウェルカムFlex Card返信
- 登録成功時に初回占いも即配信
- 占い閲覧3回に1回有料鑑定誘導付きカード
- 「個別鑑定」テキストで鑑定説明Flex Message返信

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 4: リッチメニュー設定スクリプト

### 4-1. 実装（`scripts/fortune/setup-rich-menu.js`）

- [ ] `scripts/fortune/setup-rich-menu.js` を新規作成:

```js
// ファイル: scripts/fortune/setup-rich-menu.js
'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const { messagingApi } = require('@line/bot-sdk');
const fs = require('node:fs');
const path = require('node:path');

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
});

const RICH_MENU_IMAGE = path.join(__dirname, '..', '..', 'assets', 'rich-menu.png');

async function main() {
  console.log('[rich-menu] Creating rich menu...');

  // リッチメニュー定義（2ボタン: 1200x405px）
  const richMenu = await client.createRichMenu({
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'fortune-main-menu',
    chatBarText: 'メニュー',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: 'message', label: '今日の占い', text: '今日の占い' },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: 'message', label: '個別鑑定', text: '個別鑑定' },
      },
    ],
  });

  const richMenuId = richMenu.richMenuId;
  console.log(`[rich-menu] Created: ${richMenuId}`);

  // リッチメニュー画像アップロード
  if (!fs.existsSync(RICH_MENU_IMAGE)) {
    console.warn(`[rich-menu] WARNING: ${RICH_MENU_IMAGE} not found.`);
    console.warn('[rich-menu] Create a 2500x843px PNG image and re-run, or upload manually via LINE Official Account Manager.');
    console.warn(`[rich-menu] Rich menu ID: ${richMenuId} (image not set)`);
  } else {
    const imageBuffer = fs.readFileSync(RICH_MENU_IMAGE);
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    await blobClient.setRichMenuImage(richMenuId, blob);
    console.log('[rich-menu] Image uploaded.');
  }

  // デフォルトリッチメニューに設定
  await client.setDefaultRichMenu(richMenuId);
  console.log('[rich-menu] Set as default rich menu.');
  console.log('[rich-menu] Done.');
}

main().catch((err) => {
  console.error('[rich-menu] Error:', err.message);
  process.exit(1);
});
```

- [ ] 構文チェック:

```bash
node -c scripts/fortune/setup-rich-menu.js
# 期待: 構文エラーなし
```

**注意**: このスクリプトは実際のLINE APIを呼ぶため、ユニットテストは書かない。実行テストはE2Eフェーズで行う。

### 4-2. リッチメニュー画像について

- [ ] `assets/rich-menu.png` は手動で作成する。要件:
  - サイズ: 2500x843px（LINE API仕様）
  - 左半分: ダークネイビー背景 + 「今日の占い」テキスト + 水晶玉アイコン
  - 右半分: ダークネイビー背景 + 「もっと深く占う」テキスト + 星アイコン
  - カラー: ダークネイビー(#1a1a2e) + ゴールド(#c9a84c)
  - **MVP**: 画像なしでもスクリプトは動く（警告表示のみ）

### コミットメッセージ

```
feat: リッチメニュー設定スクリプト追加

LINE APIでリッチメニューを作成・デフォルト設定するスクリプト。
画像は手動作成が必要（なくても動作する）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Step 5: 全体テスト & 仕上げ

### 5-1. 全テスト実行

- [ ] 全テストが通ることを確認:

```bash
npm test
# 期待: tests/test_users.js (10 tests PASS)
#        tests/test_flex_messages.js (15 tests PASS)
#        + 既存テスト全件PASS
```

### 5-2. welcome-hero.jpg プレースホルダー対応

- [ ] `assets/welcome-hero.jpg` が存在しない場合、`buildWelcomeCard` は `profile-icon.jpg` にフォールバックする処理を `lib/flex-messages.js` に追加:

```js
// buildWelcomeCard内のhero.urlを以下に変更
// 本番用のwelcome-hero.jpgがない場合はprofile-icon.jpgを使う
url: `${baseUrl}/assets/welcome-hero.jpg`,
// ※ welcome-hero.jpgが存在しない場合はExpressの静的ファイル配信で404になるため、
//   assets/welcome-hero.jpg を用意するか、profile-icon.jpg にリネームして配置する
```

- [ ] 暫定対応として `profile-icon.jpg` をコピー:

```bash
cp assets/profile-icon.jpg assets/welcome-hero.jpg
# ※ AI画像生成で正式版を作成したら差し替える
```

### 5-3. package.json の scripts にセットアップコマンド追加

- [ ] `package.json` の `scripts` に追加:

```json
"setup-rich-menu": "node scripts/fortune/setup-rich-menu.js"
```

### コミットメッセージ（最終）

```
feat: LINE導線改善 — ウェルカム・Flex Card・有料誘導・リッチメニュー

- lib/users.js: view_countサポート追加
- lib/flex-messages.js: 5種類のFlex Messageテンプレート
- server.js: follow/個別鑑定ハンドラー、Promo付き占いカード
- setup-rich-menu.js: リッチメニュー自動設定スクリプト
- テスト: test_users.js(10件), test_flex_messages.js(15件) 全PASS

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## ファイル変更サマリー

| ファイル | 操作 | 内容 |
|---------|------|------|
| `lib/users.js` | 変更 | `view_count` 初期値追加、`incrementViewCount` 関数追加 |
| `lib/flex-messages.js` | 新規 | 5つのFlex Message生成関数 |
| `scripts/fortune/server.js` | 変更 | follow/個別鑑定ハンドラー、Flex Card対応、Promo付き占い |
| `scripts/fortune/setup-rich-menu.js` | 新規 | リッチメニュー作成・設定スクリプト |
| `tests/test_users.js` | 変更 | `incrementViewCount` テスト5件追加 |
| `tests/test_flex_messages.js` | 新規 | Flex Message構造テスト15件 |
| `assets/welcome-hero.jpg` | 新規 | ウェルカム画像（暫定: profile-icon.jpgのコピー） |
| `package.json` | 変更 | `setup-rich-menu` スクリプト追加 |

## 実行順序

1. Step 1（users.js） → テスト → コミット
2. Step 2（flex-messages.js） → テスト → コミット
3. Step 3（server.js） → テスト → コミット
4. Step 4（setup-rich-menu.js） → コミット
5. Step 5（全体テスト + 仕上げ） → 最終コミット & push

## 手動対応が必要なもの

- `assets/welcome-hero.jpg`: AI画像生成ツール（Midjourney等）で星空+タロットの幻想的なイメージを作成
- `assets/rich-menu.png`: 2500x843pxのリッチメニュー画像を作成
- E2Eテスト: cloudflared tunnel経由でLINEから実際にメッセージ送受信を確認
