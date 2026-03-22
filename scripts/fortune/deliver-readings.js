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

async function uploadPdfToWorkers(requestId, pdfPath) {
  const pdfData = fs.readFileSync(pdfPath);
  console.log(`[deliver] Uploading PDF to Workers KV (${(pdfData.length / 1024).toFixed(0)} KB)...`);

  const res = await fetch(`${WORKER_URL}/api/pdf/upload?id=${requestId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'X-Api-Key': API_KEY,
    },
    body: pdfData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PDF upload failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.url;
}

async function sendPdfToLine(userId, downloadUrl, name) {
  console.log(`[deliver] Sending PDF link to ${userId}...`);

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
          type: 'flex',
          altText: `${name}さんの鑑定書が届きました`,
          contents: {
            type: 'bubble',
            size: 'mega',
            body: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#141428',
              paddingAll: '24px',
              contents: [
                { type: 'text', text: '個 別 鑑 定 書', size: 'lg', weight: 'bold', color: '#c9a84c', align: 'center' },
                { type: 'text', text: `${name}さんへ`, size: 'sm', color: '#888888', align: 'center', margin: 'md' },
                { type: 'separator', margin: 'xl', color: '#2a2a4a' },
                { type: 'text', text: `${name}さん、お待たせしました。`, size: 'sm', color: '#d0d0d0', wrap: true, margin: 'xl' },
                { type: 'text', text: `星とカードと数字をじっくり読み込んで、${name}さんだけの鑑定書を書き上げました。`, size: 'sm', color: '#d0d0d0', wrap: true, margin: 'md' },
                { type: 'text', text: '今のあなたに必要な言葉を5ページに込めています。静かな時間に、ゆっくり読んでみてください。', size: 'sm', color: '#d0d0d0', wrap: true, margin: 'md' },
                { type: 'separator', margin: 'xl', color: '#2a2a4a' },
                { type: 'text', text: 'PDFを開いた後、保存や共有もできます。', size: 'xs', color: '#666666', wrap: true, margin: 'xl' },
                { type: 'text', text: '※リンクの有効期限は30日間です。', size: 'xs', color: '#666666', wrap: true, margin: 'sm' },
                { type: 'box', layout: 'vertical', margin: 'xl', contents: [
                  { type: 'text', text: '鑑定書を開く >', size: 'md', weight: 'bold', color: '#c9a84c', align: 'center', action: { type: 'uri', label: '鑑定書を開く', uri: downloadUrl } },
                ]},
              ],
            },
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[deliver] LINE push error: ${res.status} ${text}`);
  }
}

function isDeliveryHour() {
  const jstHour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  return jstHour >= 7 && jstHour < 24;
}

async function main() {
  if (!isDeliveryHour()) {
    console.log('[deliver] Outside delivery hours (7:00-24:00 JST). Skipping.');
    return;
  }

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

      // Workers KVにアップロード
      const downloadUrl = await uploadPdfToWorkers(req.id, pdfPath);
      console.log(`[deliver] PDF URL: ${downloadUrl}`);

      // LINEにダウンロードリンク送信
      await sendPdfToLine(req.user_id, downloadUrl, req.name);

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
