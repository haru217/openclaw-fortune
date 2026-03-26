'use strict';

// 鑑定PDF生成→KVアップロード→ステータスを ready に更新
// klawのHBから実行される。LINE送信は行わない（GitHub Actionsが担当）。

require('dotenv').config({ path: require('node:path').join(__dirname, '..', '..', '.env') });

const fs = require('node:fs');
const path = require('node:path');
const { generateReadingPdf } = require('./generate-reading-pdf');

const WORKER_URL = process.env.WORKER_URL;
const API_KEY = process.env.API_KEY;

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
  console.log(`[generate] Uploading PDF to Workers KV (${(pdfData.length / 1024).toFixed(0)} KB)...`);

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

async function main() {
  console.log('[generate] Checking pending requests...');
  const requests = await fetchPendingRequests();
  const now = Date.now();

  const ready = requests.filter(r => new Date(r.deliver_after).getTime() <= now);
  console.log(`[generate] ${requests.length} pending, ${ready.length} ready to generate`);

  if (ready.length === 0) {
    console.log('[generate] Nothing to do');
    return;
  }

  for (const req of ready) {
    try {
      console.log(`[generate] Processing ${req.id} for ${req.name}...`);

      // PDF生成
      const pdfPath = await generateReadingPdf(req);

      // Workers KVにアップロード
      const downloadUrl = await uploadPdfToWorkers(req.id, pdfPath);
      console.log(`[generate] PDF URL: ${downloadUrl}`);

      // ステータスを ready に更新（LINE配信はGitHub Actionsが担当）
      await updateStatus(req.id, 'ready');
      console.log(`[generate] ${req.id} → ready`);
    } catch (err) {
      console.error(`[generate] Error for ${req.id}: ${err.message}`);
      await updateStatus(req.id, 'error');
    }
  }

  console.log('[generate] Done');
}

main().catch(err => {
  console.error('[generate] Fatal:', err.message);
  process.exit(1);
});
