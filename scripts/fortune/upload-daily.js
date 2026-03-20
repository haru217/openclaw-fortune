'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');

const DAILY_DIR = path.join(__dirname, '..', '..', 'data', 'daily');

async function uploadToWorkers(date, fortunes) {
  const workerUrl = process.env.WORKER_URL;
  const apiKey = process.env.API_KEY;

  if (!workerUrl || !apiKey) {
    console.error('[upload] WORKER_URL or API_KEY not set');
    process.exit(1);
  }

  console.log(`[upload] Uploading ${date} to Workers...`);

  const response = await fetch(`${workerUrl}/api/daily`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ date, fortunes }),
  });

  const result = await response.json();
  if (result.ok) {
    console.log('[upload] OK');
  } else {
    console.error('[upload] FAILED', result);
    process.exit(1);
  }
}

const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const file = path.join(DAILY_DIR, `${today}.json`);

if (!fs.existsSync(file)) {
  console.error(`[upload] ${file} が見つかりません。先にバッチを実行してください。`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const fortunes = data.fortunes || data;

uploadToWorkers(today, fortunes).catch(err => {
  console.error('[upload] Fatal:', err.message);
  process.exit(1);
});
