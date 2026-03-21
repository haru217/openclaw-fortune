'use strict';

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const { generateReadingPdf } = require('./generate-reading-pdf');

const WORKER_URL = process.env.WORKER_URL;
const API_KEY = process.env.API_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'data', 'readings');

async function fetchPendingRequests() {
  const res = await fetch(`${WORKER_URL}/api/readings`, {
    headers: { 'X-Api-Key': API_KEY },
  });
  const data = await res.json();
  return data.requests || [];
}

async function updateStatus(requestId, status) {
  await fetch(`${WORKER_URL}/api/readings/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ id: requestId, status }),
  });
}

async function sendPdfToLine(userId, pdfPath, name) {
  // LINE Push Message でファイルを送るには、まず画像/動画/音声のみ対応。
  // PDF はそのまま送れないので、テキストメッセージ + リッチメニューで案内するか、
  // 一旦画像に変換するか、外部URLで配信する。
  // ここでは Workers にアップロードして URL を送る方式。

  // PDF を Workers KV に保存してダウンロードURLを生成する代わりに、
  // シンプルにテキストメッセージで完了を通知する（PDF配信は後日実装）
  console.log(`[deliver] Sending notification to ${userId}...`);

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [
        {
          type: 'text',
          text: `${name}さん、鑑定が完了しました✨\n\n鑑定書をお送りしますので少々お待ちください。`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[deliver] LINE push error: ${res.status} ${text}`);
  }
}

async function main() {
  console.log('[deliver] Checking pending requests...');
  const requests = await fetchPendingRequests();
  const now = Date.now();

  const ready = requests.filter(r => new Date(r.deliver_after).getTime() <= now);
  console.log(`[deliver] ${requests.length} pending, ${ready.length} ready to deliver`);

  for (const req of ready) {
    try {
      console.log(`[deliver] Processing ${req.id} for ${req.name}...`);

      // PDF生成
      const pdfPath = await generateReadingPdf(req);

      // LINE通知
      await sendPdfToLine(req.user_id, pdfPath, req.name);

      // ステータス更新
      await updateStatus(req.id, 'delivered');
      console.log(`[deliver] Delivered ${req.id}`);
    } catch (err) {
      console.error(`[deliver] Error for ${req.id}: ${err.message}`);
      await updateStatus(req.id, 'error');
    }
  }

  console.log('[deliver] Done');
}

main().catch(err => {
  console.error('[deliver] Fatal:', err.message);
  process.exit(1);
});
