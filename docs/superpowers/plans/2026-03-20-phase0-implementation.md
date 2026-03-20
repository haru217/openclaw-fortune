# Phase 0 + 0.5 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the lib modules (zodiac, tarot, ephemeris) with full test coverage, then wire up the MVP pipeline (batch fortune generation → LINE webhook reply).

**Architecture:** Three pure lib modules with no external dependencies (testable in isolation), then two scripts that compose them: `batch-fortune.js` calls klaw Gateway API to generate daily fortunes as JSON, `server.js` runs an Express webhook that reads the JSON and replies via LINE Messaging API.

**Tech Stack:** Node.js >= 20 (built-in test runner), CommonJS, Express, @line/bot-sdk, no TypeScript, no frameworks.

**Spec:** `docs/superpowers/specs/2026-03-20-fortune-system-design.md`

**Test runner:** `node --test tests/`

---

## File Map

| File | Responsibility | Phase |
|------|---------------|-------|
| `lib/zodiac.js` | Zodiac sign lookup from date or birthday string | 0 |
| `tests/test_zodiac.js` | Tests for zodiac module | 0 |
| `lib/tarot.js` | Draw random tarot cards, look up meanings from JSON | 0 |
| `tests/test_tarot.js` | Tests for tarot module | 0 |
| `lib/ephemeris.js` | Look up ephemeris data for a date | 0 |
| `tests/test_ephemeris.js` | Tests for ephemeris module | 0 |
| `scripts/fortune/batch-fortune.js` | Morning cron: call klaw, save daily JSON | 0.5 |
| `scripts/fortune/server.js` | Express webhook: LINE reply + user registration | 0.5 |
| `lib/users.js` | Read/write `data/users.json` | 0.5 |
| `tests/test_users.js` | Tests for users module | 0.5 |
| `lib/daily-fortune.js` | Read/write `data/daily/*.json` | 0.5 |
| `tests/test_daily_fortune.js` | Tests for daily-fortune module | 0.5 |
| `.env.example` | Template for required env vars | 0.5 |

---

## Chunk 1: lib/zodiac.js

### Task 1: lib/zodiac.js — ZODIAC_SIGNS constant and getZodiacSign

**Files:**
- Create: `lib/zodiac.js`
- Create: `tests/test_zodiac.js`

- [ ] **Step 1: Write failing tests for `ZODIAC_SIGNS` and `getZodiacSign`**

Create `tests/test_zodiac.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/test_zodiac.js`
Expected: FAIL — cannot find module `../lib/zodiac`

- [ ] **Step 3: Implement lib/zodiac.js — ZODIAC_SIGNS and getZodiacSign**

Create `lib/zodiac.js`:

```js
'use strict';

const ZODIAC_SIGNS = [
  { id: 'aries',       name: '牡羊座',   startMonth: 3,  startDay: 21 },
  { id: 'taurus',      name: '牡牛座',   startMonth: 4,  startDay: 20 },
  { id: 'gemini',      name: '双子座',   startMonth: 5,  startDay: 21 },
  { id: 'cancer',      name: '蟹座',     startMonth: 6,  startDay: 22 },
  { id: 'leo',         name: '獅子座',   startMonth: 7,  startDay: 23 },
  { id: 'virgo',       name: '乙女座',   startMonth: 8,  startDay: 23 },
  { id: 'libra',       name: '天秤座',   startMonth: 9,  startDay: 23 },
  { id: 'scorpio',     name: '蠍座',     startMonth: 10, startDay: 23 },
  { id: 'sagittarius', name: '射手座',   startMonth: 11, startDay: 23 },
  { id: 'capricorn',   name: '山羊座',   startMonth: 12, startDay: 22 },
  { id: 'aquarius',    name: '水瓶座',   startMonth: 1,  startDay: 20 },
  { id: 'pisces',      name: '魚座',     startMonth: 2,  startDay: 19 },
];

function parseMonthDay(input) {
  // Accept: MM-DD, MM/DD, YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD, M月D日
  let month, day;

  const jpMatch = input.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (jpMatch) {
    month = parseInt(jpMatch[1], 10);
    day = parseInt(jpMatch[2], 10);
  } else {
    const cleaned = input.replace(/\//g, '-');
    const parts = cleaned.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    } else if (parts.length === 1 && parts[0].length === 8) {
      month = parseInt(parts[0].slice(4, 6), 10);
      day = parseInt(parts[0].slice(6, 8), 10);
    } else {
      throw new Error(`Invalid date format: ${input}`);
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid date: month=${month}, day=${day}`);
  }

  return { month, day };
}

function getZodiacSign(dateString) {
  const { month, day } = parseMonthDay(dateString);

  // Iterate signs in order. Each sign starts at (startMonth, startDay).
  // A date belongs to a sign if it's >= that sign's start and < next sign's start.
  // Special handling for Capricorn which wraps around the year boundary.
  for (let i = 0; i < ZODIAC_SIGNS.length; i++) {
    const sign = ZODIAC_SIGNS[i];
    const next = ZODIAC_SIGNS[(i + 1) % ZODIAC_SIGNS.length];

    const afterStart = (month > sign.startMonth) ||
      (month === sign.startMonth && day >= sign.startDay);
    const beforeNext = (month < next.startMonth) ||
      (month === next.startMonth && day < next.startDay);

    // Normal case (no year wrap)
    if (sign.startMonth < next.startMonth) {
      if (afterStart && beforeNext) return { ...sign };
    } else {
      // Year-wrapping case (Capricorn: Dec 22 - Jan 19)
      if (afterStart || beforeNext) return { ...sign };
    }
  }

  throw new Error(`Could not determine zodiac sign for ${dateString}`);
}

module.exports = { ZODIAC_SIGNS, getZodiacSign, parseMonthDay };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/test_zodiac.js`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/zodiac.js tests/test_zodiac.js
git commit -m "feat: lib/zodiac.js — 星座判定モジュール + テスト

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: lib/zodiac.js — getZodiacSignFromBirthday (multi-format birthday parsing)

**Files:**
- Modify: `lib/zodiac.js`
- Modify: `tests/test_zodiac.js`

- [ ] **Step 1: Add failing tests for `getZodiacSignFromBirthday`**

Append to `tests/test_zodiac.js`:

```js
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
```

- [ ] **Step 2: Run tests — new tests should fail**

Run: `node --test tests/test_zodiac.js`
Expected: New `getZodiacSignFromBirthday` tests FAIL

- [ ] **Step 3: Implement getZodiacSignFromBirthday**

Add to `lib/zodiac.js` before `module.exports`:

```js
function getZodiacSignFromBirthday(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid birthday: empty or not a string');
  }

  const trimmed = input.trim();
  if (!trimmed) throw new Error('Invalid birthday: empty string');

  // Extract year if present
  let year = null;
  let dateForSign;

  const jpMatch = trimmed.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (jpMatch) {
    dateForSign = trimmed;
  } else {
    const cleaned = trimmed.replace(/\//g, '-');
    const parts = cleaned.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      year = parts[0];
      dateForSign = `${parts[1]}-${parts[2]}`;
    } else if (parts.length === 2) {
      dateForSign = trimmed;
    } else if (parts.length === 1 && parts[0].length === 8) {
      year = parts[0].slice(0, 4);
      dateForSign = `${parts[0].slice(4, 6)}-${parts[0].slice(6, 8)}`;
    } else {
      throw new Error(`Invalid birthday format: ${input}`);
    }
  }

  const sign = getZodiacSign(dateForSign);

  const { month, day } = parseMonthDay(dateForSign);
  const birthday = year
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;

  return { ...sign, birthday };
}
```

Update `module.exports`:

```js
module.exports = { ZODIAC_SIGNS, getZodiacSign, getZodiacSignFromBirthday, parseMonthDay };
```

- [ ] **Step 4: Run all zodiac tests**

Run: `node --test tests/test_zodiac.js`
Expected: All tests PASS (19 total)

- [ ] **Step 5: Commit**

```bash
git add lib/zodiac.js tests/test_zodiac.js
git commit -m "feat: getZodiacSignFromBirthday — 多形式の生年月日パース

YYYY/MM/DD, YYYY-MM-DD, YYYYMMDD, MM/DD, M月D日 に対応

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: lib/tarot.js

### Task 3: lib/tarot.js — MAJOR_ARCANA constant and getCardMeaning

**Files:**
- Create: `lib/tarot.js`
- Create: `tests/test_tarot.js`

- [ ] **Step 1: Write failing tests**

Create `tests/test_tarot.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MAJOR_ARCANA, getCardMeaning } = require('../lib/tarot');

describe('MAJOR_ARCANA', () => {
  it('has exactly 22 cards', () => {
    assert.equal(MAJOR_ARCANA.length, 22);
  });

  it('first card is The Fool (id: 0)', () => {
    assert.equal(MAJOR_ARCANA[0].id, 0);
    assert.equal(MAJOR_ARCANA[0].name, '愚者');
  });

  it('last card is The World (id: 21)', () => {
    assert.equal(MAJOR_ARCANA[21].id, 21);
    assert.equal(MAJOR_ARCANA[21].name, '世界');
  });
});

describe('getCardMeaning', () => {
  it('returns meaning for The Fool (id 0)', () => {
    const meaning = getCardMeaning(0);
    assert.equal(meaning.name, '愚者');
    assert.ok(meaning.meaning.upright);
    assert.ok(meaning.meaning.reversed);
    assert.ok(meaning.keywords.upright.length > 0);
  });

  it('returns meaning for The World (id 21)', () => {
    const meaning = getCardMeaning(21);
    assert.equal(meaning.name, '世界');
  });

  it('throws on invalid id', () => {
    assert.throws(() => getCardMeaning(22), /not found/i);
  });

  it('throws on negative id', () => {
    assert.throws(() => getCardMeaning(-1), /not found/i);
  });
});
```

- [ ] **Step 2: Run tests — should fail**

Run: `node --test tests/test_tarot.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement MAJOR_ARCANA and getCardMeaning**

Create `lib/tarot.js`:

```js
'use strict';

const path = require('node:path');
const fs = require('node:fs');

const DATA_PATH = path.join(__dirname, '..', 'data', 'tarot-meanings.json');
const MAJOR_ARCANA = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

function getCardMeaning(cardId) {
  const card = MAJOR_ARCANA.find(c => c.id === cardId);
  if (!card) throw new Error(`Card not found: id=${cardId}`);
  return { ...card };
}

module.exports = { MAJOR_ARCANA, getCardMeaning };
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/test_tarot.js`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tarot.js tests/test_tarot.js
git commit -m "feat: lib/tarot.js — タロット意味辞書 + getCardMeaning

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: lib/tarot.js — drawCards

**Files:**
- Modify: `lib/tarot.js`
- Modify: `tests/test_tarot.js`

- [ ] **Step 1: Add failing tests for drawCards**

Append to `tests/test_tarot.js`:

```js
const { drawCards } = require('../lib/tarot');

describe('drawCards', () => {
  it('returns requested number of cards', () => {
    const cards = drawCards(3);
    assert.equal(cards.length, 3);
  });

  it('returns cards with id, name, reversed fields', () => {
    const cards = drawCards(1);
    assert.ok('id' in cards[0]);
    assert.ok('name' in cards[0]);
    assert.ok('reversed' in cards[0]);
  });

  it('returns no duplicates', () => {
    const cards = drawCards(10);
    const ids = cards.map(c => c.id);
    assert.equal(new Set(ids).size, 10);
  });

  it('with allowReversed=false, all cards are upright', () => {
    const cards = drawCards(22, false);
    assert.ok(cards.every(c => c.reversed === false));
  });

  it('throws if count > 22', () => {
    assert.throws(() => drawCards(23), /cannot draw/i);
  });

  it('throws if count < 1', () => {
    assert.throws(() => drawCards(0), /cannot draw/i);
  });
});
```

- [ ] **Step 2: Run tests — new tests fail**

Run: `node --test tests/test_tarot.js`
Expected: `drawCards` tests FAIL

- [ ] **Step 3: Implement drawCards**

Add to `lib/tarot.js` before `module.exports`:

```js
function drawCards(count, allowReversed = true) {
  if (count < 1 || count > 22) {
    throw new Error(`Cannot draw ${count} cards (must be 1-22)`);
  }

  // Fisher-Yates shuffle on indices
  const indices = Array.from({ length: 22 }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, count).map(idx => {
    const card = MAJOR_ARCANA[idx];
    const reversed = allowReversed ? Math.random() < 0.5 : false;
    return { id: card.id, name: card.name, nameEn: card.nameEn, reversed };
  });
}
```

Update `module.exports`:

```js
module.exports = { MAJOR_ARCANA, getCardMeaning, drawCards };
```

- [ ] **Step 4: Run all tarot tests**

Run: `node --test tests/test_tarot.js`
Expected: All 13 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/tarot.js tests/test_tarot.js
git commit -m "feat: drawCards — タロットカードランダム抽選

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 3: lib/ephemeris.js

### Task 5: lib/ephemeris.js — getEphemeris and getMoonPhase

**Files:**
- Create: `lib/ephemeris.js`
- Create: `tests/test_ephemeris.js`

- [ ] **Step 1: Write failing tests**

Create `tests/test_ephemeris.js`:

```js
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
```

- [ ] **Step 2: Run tests — should fail**

Run: `node --test tests/test_ephemeris.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement lib/ephemeris.js**

Create `lib/ephemeris.js`:

```js
'use strict';

const path = require('node:path');
const fs = require('node:fs');

const DATA_PATH = path.join(__dirname, '..', 'data', 'ephemeris-2026.json');
const ephemerisData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// Build a lookup map for O(1) access
const dateMap = new Map();
for (const entry of ephemerisData.data) {
  dateMap.set(entry.date, entry);
}

function getEphemeris(dateString) {
  const entry = dateMap.get(dateString);
  if (!entry) throw new Error(`Ephemeris data not found for: ${dateString}`);
  return { ...entry };
}

function getMoonPhase(dateString) {
  const entry = getEphemeris(dateString);
  return entry.moonPhase;
}

module.exports = { getEphemeris, getMoonPhase };
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/test_ephemeris.js`
Expected: All 8 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `node --test tests/`
Expected: All tests across all 3 modules PASS

- [ ] **Step 6: Commit**

```bash
git add lib/ephemeris.js tests/test_ephemeris.js
git commit -m "feat: lib/ephemeris.js — 天体暦参照モジュール + テスト

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 4: lib/users.js + lib/daily-fortune.js (data access layer)

### Task 6: lib/users.js — user registration storage

**Files:**
- Create: `lib/users.js`
- Create: `tests/test_users.js`

- [ ] **Step 1: Write failing tests**

Create `tests/test_users.js`:

```js
const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadUsers, saveUser, getUser } = require('../lib/users');

const TEST_PATH = path.join(__dirname, 'tmp_users.json');

describe('users', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_PATH)) fs.unlinkSync(TEST_PATH);
  });

  after(() => {
    if (fs.existsSync(TEST_PATH)) fs.unlinkSync(TEST_PATH);
  });

  it('loadUsers returns empty object when file does not exist', () => {
    const users = loadUsers(TEST_PATH);
    assert.deepEqual(users, {});
  });

  it('saveUser creates file and saves user', () => {
    saveUser(TEST_PATH, 'U123', { sign: 'aries', birthday: '1990-03-25' });
    const data = JSON.parse(fs.readFileSync(TEST_PATH, 'utf8'));
    assert.equal(data['U123'].sign, 'aries');
    assert.equal(data['U123'].birthday, '1990-03-25');
    assert.ok(data['U123'].registered_at);
  });

  it('saveUser appends to existing users', () => {
    saveUser(TEST_PATH, 'U001', { sign: 'aries', birthday: null });
    saveUser(TEST_PATH, 'U002', { sign: 'taurus', birthday: null });
    const data = loadUsers(TEST_PATH);
    assert.equal(Object.keys(data).length, 2);
  });

  it('getUser returns user data', () => {
    saveUser(TEST_PATH, 'U123', { sign: 'scorpio', birthday: '1990-10-23' });
    const user = getUser(TEST_PATH, 'U123');
    assert.equal(user.sign, 'scorpio');
  });

  it('getUser returns null for unknown user', () => {
    const user = getUser(TEST_PATH, 'UNKNOWN');
    assert.equal(user, null);
  });
});
```

- [ ] **Step 2: Run tests — should fail**

Run: `node --test tests/test_users.js`
Expected: FAIL

- [ ] **Step 3: Implement lib/users.js**

Create `lib/users.js`:

```js
'use strict';

const fs = require('node:fs');

function loadUsers(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveUser(filePath, userId, { sign, birthday }) {
  const users = loadUsers(filePath);
  users[userId] = {
    sign,
    birthday: birthday || null,
    registered_at: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');
}

function getUser(filePath, userId) {
  const users = loadUsers(filePath);
  return users[userId] || null;
}

module.exports = { loadUsers, saveUser, getUser };
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/test_users.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/users.js tests/test_users.js
git commit -m "feat: lib/users.js — ユーザー星座登録の読み書き

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: lib/daily-fortune.js — daily fortune JSON read/write

**Files:**
- Create: `lib/daily-fortune.js`
- Create: `tests/test_daily_fortune.js`

- [ ] **Step 1: Write failing tests**

Create `tests/test_daily_fortune.js`:

```js
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
```

- [ ] **Step 2: Run tests — should fail**

Run: `node --test tests/test_daily_fortune.js`
Expected: FAIL

- [ ] **Step 3: Implement lib/daily-fortune.js**

Create `lib/daily-fortune.js`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function saveDailyFortune(dir, dateString, fortunes) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const data = {
    date: dateString,
    generated_at: new Date().toISOString(),
    fortunes,
  };

  const filePath = path.join(dir, `${dateString}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadDailyFortune(dir, dateString, options = {}) {
  const { fallbackDays = 0 } = options;

  const filePath = path.join(dir, `${dateString}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  // Try previous days as fallback
  for (let i = 1; i <= fallbackDays; i++) {
    const d = new Date(dateString);
    d.setDate(d.getDate() - i);
    const fallbackDate = d.toISOString().slice(0, 10);
    const fallbackPath = path.join(dir, `${fallbackDate}.json`);
    if (fs.existsSync(fallbackPath)) {
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    }
  }

  return null;
}

module.exports = { saveDailyFortune, loadDailyFortune };
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/test_daily_fortune.js`
Expected: All 4 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `node --test tests/`
Expected: All tests PASS across all modules

- [ ] **Step 6: Commit**

```bash
git add lib/daily-fortune.js tests/test_daily_fortune.js
git commit -m "feat: lib/daily-fortune.js — 日次占いJSON読み書き + フォールバック

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 5: scripts/fortune/batch-fortune.js

### Task 8: batch-fortune.js — morning batch that calls klaw Gateway

**Files:**
- Create: `scripts/fortune/batch-fortune.js`
- Modify: `lib/daily-fortune.js` (already created)

This script is NOT unit-tested (it calls an external API). Test it by running manually and checking the output JSON.

- [ ] **Step 1: Create scripts/fortune/ directory**

```bash
mkdir -p scripts/fortune
```

- [ ] **Step 2: Create .env.example**

Create `.env.example`:

```
# LINE Messaging API
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_access_token

# klaw Gateway
KLAW_GATEWAY_URL=http://localhost:18789
```

- [ ] **Step 2.5: Add dotenv to dependencies**

Run: `npm install dotenv`

- [ ] **Step 3: Implement batch-fortune.js**

Create `scripts/fortune/batch-fortune.js`:

```js
'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const { getEphemeris } = require('../../lib/ephemeris');
const { drawCards, getCardMeaning } = require('../../lib/tarot');
const { ZODIAC_SIGNS } = require('../../lib/zodiac');
const { saveDailyFortune } = require('../../lib/daily-fortune');

const DAILY_DIR = path.join(__dirname, '..', '..', 'data', 'daily');
const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'data', 'templates', 'line-daily.txt');
const GATEWAY_URL = process.env.KLAW_GATEWAY_URL || 'http://localhost:18789';

async function callKlaw(message, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session: 'isolated' }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        throw new Error(`klaw API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      return data.response;
    } catch (err) {
      if (attempt < retries) {
        console.log(`[batch]   Retry ${attempt + 1}/${retries}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }
}

function buildPrompt(template, sign, date, ephemeris, card) {
  const position = card.reversed ? '逆位置' : '正位置';
  const meaning = getCardMeaning(card.id);

  return template
    .replace(/\{\{zodiac_sign\}\}/g, sign.name)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{moon_phase\}\}/g, ephemeris.moonPhase)
    .replace(/\{\{card_name\}\}/g, card.name)
    .replace(/\{\{position\}\}/g, position)
    .replace(/\{\{lucky_color\}\}/g, meaning.luckyColor)
    .replace(/\{\{lucky_number\}\}/g, String(Math.floor(Math.random() * 9) + 1));
}

async function generateDailyFortunes(date) {
  console.log(`[batch] Generating fortunes for ${date}`);

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const ephemeris = getEphemeris(date);
  const cards = drawCards(12, true);

  const fortunes = {};

  for (let i = 0; i < ZODIAC_SIGNS.length; i++) {
    const sign = ZODIAC_SIGNS[i];
    const card = cards[i];
    const prompt = buildPrompt(template, sign, date, ephemeris, card);

    console.log(`[batch]   ${sign.name} (${sign.id}) — ${card.name}`);

    try {
      const response = await callKlaw(prompt);

      fortunes[sign.id] = {
        sign: sign.name,
        message: response,
        lucky_item: '', // klaw will include this in the message
        card: { id: card.id, name: card.name, reversed: card.reversed },
      };
    } catch (err) {
      console.error(`[batch]   ERROR for ${sign.id}: ${err.message}`);
      fortunes[sign.id] = {
        sign: sign.name,
        message: `本日の${sign.name}の運勢は準備中です。しばらくお待ちください🌙`,
        lucky_item: '',
        card: { id: card.id, name: card.name, reversed: card.reversed },
      };
    }
  }

  saveDailyFortune(DAILY_DIR, date, fortunes);
  console.log(`[batch] Saved to data/daily/${date}.json`);
}

// Main
const today = new Date().toISOString().slice(0, 10);
generateDailyFortunes(today).then(() => {
  console.log('[batch] Done');
}).catch(err => {
  console.error('[batch] Fatal error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 4: Test manually (klaw Gateway must be running)**

Run: `node scripts/fortune/batch-fortune.js`
Expected: Creates `data/daily/2026-03-20.json` with 12 zodiac entries. If klaw is not running, each sign gets the fallback message.

- [ ] **Step 5: Commit**

```bash
git add scripts/fortune/batch-fortune.js .env.example
git commit -m "feat: batch-fortune.js — 朝バッチで12星座分の占いを生成

klaw Gateway API経由で一括生成、data/daily/に保存

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 6: scripts/fortune/server.js (LINE webhook)

### Task 9: server.js — Express webhook for LINE reply + user registration

**Files:**
- Create: `scripts/fortune/server.js`

This is an integration script (Express + LINE SDK). Test by manual E2E with LINE.

- [ ] **Step 1: Install dependencies**

Run: `cd C:\Users\senta\openclaw-fortune && npm install`

- [ ] **Step 2: Implement server.js**

Create `scripts/fortune/server.js`:

```js
'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const path = require('node:path');
const express = require('express');
const { middleware, messagingApi } = require('@line/bot-sdk');

const { getZodiacSignFromBirthday } = require('../../lib/zodiac');
const { loadDailyFortune } = require('../../lib/daily-fortune');
const { getUser, saveUser } = require('../../lib/users');

const DAILY_DIR = path.join(__dirname, '..', '..', 'data', 'daily');
const USERS_PATH = path.join(__dirname, '..', '..', 'data', 'users.json');

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const app = express();

// LINE webhook signature verification
app.post('/webhook', middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.json({ ok: true });
  } catch (err) {
    console.error('[webhook] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return;
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();

  // Check if user is registered
  const user = getUser(USERS_PATH, userId);

  if (!user) {
    return handleRegistration(event, userId, text);
  }

  // Registered user — check for "今日の占い" trigger
  if (text === '今日の占い' || text === '占い') {
    return handleDailyFortune(event, user);
  }

  // Default: remind about rich menu
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'リッチメニューの「今日の占い」をタップしてみてください🌙' }],
  });
}

async function handleRegistration(event, userId, text) {
  // Try to parse as birthday
  try {
    const result = getZodiacSignFromBirthday(text);
    saveUser(USERS_PATH, userId, { sign: result.id, birthday: result.birthday });

    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: `${result.name}ですね。登録しました✨\nリッチメニューから「今日の占い」をどうぞ🌙`,
      }],
    });
  } catch (_) {
    // Not a valid birthday — prompt for it
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: 'はじめまして、カイです🌙\n生年月日を教えてください（例: 1990/10/23）',
      }],
    });
  }
}

async function handleDailyFortune(event, user) {
  const today = new Date().toISOString().slice(0, 10);
  const data = loadDailyFortune(DAILY_DIR, today, { fallbackDays: 1 });

  if (!data || !data.fortunes[user.sign]) {
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '本日の占いは準備中です。もう少しお待ちください🌙' }],
    });
  }

  const fortune = data.fortunes[user.sign];
  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: fortune.message }],
  });
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
});
```

- [ ] **Step 3: Verify server starts**

Run: `LINE_CHANNEL_SECRET=dummy LINE_CHANNEL_ACCESS_TOKEN=dummy node scripts/fortune/server.js`
Expected: `[server] Listening on port 3000` — then Ctrl+C to stop

- [ ] **Step 4: Test health endpoint**

In another terminal: `curl http://localhost:3000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 5: Commit**

```bash
git add scripts/fortune/server.js
git commit -m "feat: server.js — LINE webhook（星座登録 + 今日の占いリプライ）

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 7: Final verification

### Task 10: Full test suite + integration check

- [ ] **Step 1: Run full test suite**

Run: `node --test tests/`
Expected: All tests PASS (49 tests across 5 test files: zodiac 19, tarot 13, ephemeris 8, users 5, daily-fortune 4)

- [ ] **Step 2: Verify batch creates JSON**

Run: `node scripts/fortune/batch-fortune.js`
Check: `data/daily/` contains today's JSON with 12 zodiac entries

- [ ] **Step 3: Verify server starts and health responds**

Run: `LINE_CHANNEL_SECRET=dummy LINE_CHANNEL_ACCESS_TOKEN=dummy node scripts/fortune/server.js &`
Run: `curl http://localhost:3000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 4: Final commit with all remaining files**

```bash
git add -n .
# Review output — commit any remaining files individually
git status
```

- [ ] **Step 5: Report completion status**

```
Verified: node --test tests/ → [N/N pass]
Verified: batch-fortune.js → data/daily/{date}.json created
Verified: server.js → health endpoint responds
Status: Phase 0 + 0.5 COMPLETE
```
