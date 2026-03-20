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
