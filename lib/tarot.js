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

module.exports = { MAJOR_ARCANA, getCardMeaning, drawCards };
