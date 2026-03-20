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

const TEST_FORTUNE = {
  sign: '牡羊座',
  message: '今日はいい日です',
  lucky_item: '白いハンカチ',
  card: { id: 0, name: '愚者', reversed: false },
};

// Helper: recursively extract all string values from a flex message object
function allStrings(obj) {
  if (typeof obj === 'string') return [obj];
  if (Array.isArray(obj)) return obj.flatMap(allStrings);
  if (obj && typeof obj === 'object') return Object.values(obj).flatMap(allStrings);
  return [];
}

describe('buildWelcomeCard', () => {
  it('returns a bubble type flex message', () => {
    const card = buildWelcomeCard(BASE_URL);
    assert.equal(card.type, 'bubble');
  });

  it('hero image uses baseUrl', () => {
    const card = buildWelcomeCard(BASE_URL);
    const strings = allStrings(card);
    assert.ok(
      strings.some(s => s.includes(BASE_URL)),
      'hero image should contain baseUrl'
    );
  });

  it('body mentions カイ', () => {
    const card = buildWelcomeCard(BASE_URL);
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('カイ')), 'should mention カイ');
  });

  it('body mentions 生年月日', () => {
    const card = buildWelcomeCard(BASE_URL);
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('生年月日')), 'should mention 生年月日');
  });
});

describe('buildRegistrationCompleteCard', () => {
  it('returns a bubble type flex message', () => {
    const card = buildRegistrationCompleteCard('牡羊座', '運気上昇中です', BASE_URL);
    assert.equal(card.type, 'bubble');
  });

  it('includes sign name', () => {
    const card = buildRegistrationCompleteCard('牡羊座', '運気上昇中です', BASE_URL);
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('牡羊座')), 'should include sign name');
  });

  it('includes fortune message', () => {
    const card = buildRegistrationCompleteCard('牡羊座', '運気上昇中です', BASE_URL);
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('運気上昇中です')), 'should include fortune message');
  });

  it('includes education text about 毎日 and 無料', () => {
    const card = buildRegistrationCompleteCard('牡羊座', '運気上昇中です', BASE_URL);
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('毎日')), 'should mention 毎日');
    assert.ok(strings.some(s => s.includes('無料')), 'should mention 無料');
  });
});

describe('buildFortuneCard', () => {
  it('returns a bubble type flex message', () => {
    const card = buildFortuneCard(TEST_FORTUNE, BASE_URL);
    assert.equal(card.type, 'bubble');
  });

  it('includes tarot image URL with baseUrl', () => {
    const card = buildFortuneCard(TEST_FORTUNE, BASE_URL);
    const strings = allStrings(card);
    assert.ok(
      strings.some(s => s.includes(BASE_URL) && s.includes('tarot')),
      'should include tarot image URL with baseUrl'
    );
  });

  it('tarot image URL contains the correct filename for card id 0', () => {
    const card = buildFortuneCard(TEST_FORTUNE, BASE_URL);
    const strings = allStrings(card);
    assert.ok(
      strings.some(s => s.includes('00-fool')),
      'card id 0 should map to 00-fool'
    );
  });

  it('includes fortune message', () => {
    const card = buildFortuneCard(TEST_FORTUNE, BASE_URL);
    const strings = allStrings(card);
    assert.ok(
      strings.some(s => s.includes('今日はいい日です')),
      'should include fortune message'
    );
  });
});

describe('buildFortuneCardWithPromo', () => {
  it('returns a bubble type flex message', () => {
    const card = buildFortuneCardWithPromo(TEST_FORTUNE, BASE_URL);
    assert.equal(card.type, 'bubble');
  });

  it('includes fortune message', () => {
    const card = buildFortuneCardWithPromo(TEST_FORTUNE, BASE_URL);
    const strings = allStrings(card);
    assert.ok(
      strings.some(s => s.includes('今日はいい日です')),
      'should include fortune message'
    );
  });

  it('includes promo text about 個別鑑定', () => {
    const card = buildFortuneCardWithPromo(TEST_FORTUNE, BASE_URL);
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('個別鑑定')), 'should include 個別鑑定');
  });

  it('includes promo text about もっと深く', () => {
    const card = buildFortuneCardWithPromo(TEST_FORTUNE, BASE_URL);
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('もっと深く')), 'should include もっと深く');
  });
});

describe('buildPaidReadingInfo', () => {
  it('returns a bubble type flex message', () => {
    const card = buildPaidReadingInfo();
    assert.equal(card.type, 'bubble');
  });

  it('includes price 2,000', () => {
    const card = buildPaidReadingInfo();
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('2,000')), 'should include price 2,000');
  });

  it('includes 占星術', () => {
    const card = buildPaidReadingInfo();
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('占星術')), 'should include 占星術');
  });

  it('includes タロット', () => {
    const card = buildPaidReadingInfo();
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('タロット')), 'should include タロット');
  });

  it('includes 鑑定', () => {
    const card = buildPaidReadingInfo();
    const strings = allStrings(card);
    assert.ok(strings.some(s => s.includes('鑑定')), 'should include 鑑定');
  });
});
