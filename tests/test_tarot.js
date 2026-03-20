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
