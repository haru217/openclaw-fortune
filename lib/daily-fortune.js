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
