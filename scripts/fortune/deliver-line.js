'use strict';

// ready 状態の鑑定リクエストをLINEで配信し、delivered に更新する
// GitHub Actions から実行。AI不要・Playwright不要・依存ゼロ（Node.js標準のみ）。

const WORKER_URL = process.env.WORKER_URL;
const API_KEY = process.env.API_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function fetchReadyRequests() {
  const res = await fetch(`${WORKER_URL}/api/readings?status=ready`, {
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

function buildPdfUrl(requestId) {
  return `${WORKER_URL}/pdf/${requestId}`;
}

async function sendPdfToLine(userId, downloadUrl, name) {
  console.log(`[deliver-line] Sending PDF link to ${userId}...`);

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
    throw new Error(`LINE push error: ${res.status} ${text}`);
  }
}

function isDeliveryHour() {
  const jstHour = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  return jstHour >= 7 && jstHour < 24;
}

async function main() {
  if (!isDeliveryHour()) {
    console.log('[deliver-line] Outside delivery hours (7:00-24:00 JST). Skipping.');
    return;
  }

  console.log('[deliver-line] Checking ready requests...');
  const requests = await fetchReadyRequests();
  console.log(`[deliver-line] ${requests.length} ready to deliver`);

  if (requests.length === 0) {
    console.log('[deliver-line] Nothing to deliver');
    return;
  }

  for (const req of requests) {
    try {
      const downloadUrl = buildPdfUrl(req.id);
      await sendPdfToLine(req.user_id, downloadUrl, req.name);
      await updateStatus(req.id, 'delivered');
      console.log(`[deliver-line] Delivered ${req.id} to ${req.name}`);
    } catch (err) {
      console.error(`[deliver-line] Error for ${req.id}: ${err.message}`);
      await updateStatus(req.id, 'error');
    }
  }

  console.log('[deliver-line] Done');
}

main().catch(err => {
  console.error('[deliver-line] Fatal:', err.message);
  process.exit(1);
});
