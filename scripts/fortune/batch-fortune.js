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
const { execSync } = require('node:child_process');
const os = require('node:os');

function callKlaw(message, retries = 1) {
  const tmpFile = path.join(os.tmpdir(), `fortune-prompt-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, message, 'utf8');

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const stdout = execSync(
          `openclaw agent --message "$(cat '${tmpFile.replace(/\\/g, '/')}')" --session-id fortune-batch --json`,
          { timeout: 120_000, encoding: 'utf8', maxBuffer: 1024 * 1024, shell: 'bash' },
        );

        const data = JSON.parse(stdout);
        return data.result?.payloads?.[0]?.text || stdout.trim();
      } catch (err) {
        if (attempt < retries) {
          console.log(`[batch]   Retry ${attempt + 1}/${retries}: ${err.message}`);
          continue;
        }
        throw err;
      }
    }
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
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
  // NOTE: {{reading}} is intentionally NOT replaced — left for klaw to fill in
}

async function generateDailyFortunes(date) {
  const existingFile = path.join(DAILY_DIR, `${date}.json`);
  if (fs.existsSync(existingFile)) {
    console.log(`[batch] ${date} は生成済み、スキップ`);
    // 既存データをWorkersにアップロードだけ行う
    const existing = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
    await uploadToWorkers(date, existing.fortunes || existing);
    return;
  }

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

  await uploadToWorkers(date, fortunes);
}

async function uploadToWorkers(date, fortunes) {
  const workerUrl = process.env.WORKER_URL;
  const apiKey = process.env.API_KEY;

  if (!workerUrl || !apiKey) {
    console.log('[batch] WORKER_URL or API_KEY not set, skipping Workers upload');
    return;
  }

  console.log('[batch] Uploading to Workers...');

  try {
    const response = await fetch(`${workerUrl}/api/daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({ date, fortunes }),
    });

    const result = await response.json();
    console.log('[batch] Workers upload:', result.ok ? 'OK' : 'FAILED', result);
  } catch (error) {
    console.error('[batch] Workers upload error:', error.message);
  }
}

// Main
const today = new Date().toISOString().slice(0, 10);
generateDailyFortunes(today).then(() => {
  console.log('[batch] Done');
}).catch(err => {
  console.error('[batch] Fatal error:', err.message);
  process.exit(1);
});
