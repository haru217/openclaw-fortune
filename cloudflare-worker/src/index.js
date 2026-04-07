import { verifySignature, replyMessage, pushMessage } from './line.js';
import { handleEvent } from './handlers.js';
import { saveDailyFortune } from './kv.js';
import { listPendingRequests, listRequestsByStatus, updateRequestStatus, getReadingRequest } from './reading-request.js';
import { buildReadingDelivery } from './reading-messages.js';
import { runScheduledPost, refreshToken } from './threads/runner.js';
import { saveInitialToken, getToken } from './threads/log.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok' });
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env, ctx);
    }

    if (url.pathname === '/api/daily' && request.method === 'POST') {
      return handleDailyUpload(request, env);
    }

    if (url.pathname === '/api/readings' && request.method === 'GET') {
      return handleListReadings(request, env);
    }

    if (url.pathname === '/api/readings/status' && request.method === 'POST') {
      return handleUpdateReadingStatus(request, env);
    }

    // PDF アップロード（API key認証）
    if (url.pathname === '/api/pdf/upload' && request.method === 'POST') {
      return handlePdfUpload(request, env);
    }

    // PDF ダウンロード（認証なし、推測不能IDで保護）
    const pdfMatch = url.pathname.match(/^\/pdf\/([a-zA-Z0-9_-]+)$/);
    if (pdfMatch && request.method === 'GET') {
      return handlePdfDownload(pdfMatch[1], env);
    }

    // Threads: トークン投入（初回OAuth取得後に手動で叩く）
    if (url.pathname === '/api/threads/token' && request.method === 'POST') {
      return handleThreadsTokenSave(request, env);
    }

    // Threads: トークン状態確認
    if (url.pathname === '/api/threads/token' && request.method === 'GET') {
      return handleThreadsTokenStatus(request, env);
    }

    // Threads: ドライラン（投稿せずにコンテンツ生成のみ）
    if (url.pathname === '/api/threads/dryrun' && request.method === 'POST') {
      return handleThreadsDryRun(request, env);
    }

    // Threads: 月齢カレンダー投入（年次データを手動アップロード）
    if (url.pathname === '/api/threads/moon' && request.method === 'POST') {
      return handleMoonCalendarUpload(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },

  // Cron発火エントリポイント
  async scheduled(event, env, ctx) {
    const cron = event.cron;
    console.log('[scheduled] fired, cron=', cron, 'scheduledTime=', event.scheduledTime);

    // 週次トークンリフレッシュ cron ("0 3 * * 1" = 月曜3:00 UTC)
    if (cron === '0 3 * * 1') {
      ctx.waitUntil(refreshToken(env).catch((err) => {
        console.error('[scheduled] token refresh failed:', err.message);
      }));
      return;
    }

    // それ以外は通常の投稿cron
    ctx.waitUntil(
      runScheduledPost(env, event.scheduledTime).catch((err) => {
        console.error('[scheduled] post failed:', err.message, err.stack);
      })
    );
  },
};

async function handleWebhook(request, env, ctx) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature') || '';

  const valid = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const event of events) {
    try {
      const messages = await handleEvent(event, env, ctx);
      console.log('[webhook] messages count:', messages.length, 'replyToken:', !!event.replyToken);
      if (messages.length > 0 && event.replyToken) {
        const res = await replyMessage(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
        console.log('[webhook] reply status:', res.status);
      }
    } catch (error) {
      console.error('[webhook] Event error:', error.message, error.stack);
    }
  }

  return Response.json({ ok: true });
}

async function handleDailyUpload(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!data.date || !data.fortunes) {
    return Response.json({ error: 'date and fortunes required' }, { status: 400 });
  }

  await saveDailyFortune(env.FORTUNE_KV, data.date, {
    fortunes: data.fortunes,
    generated_at: new Date().toISOString(),
  });

  return Response.json({ ok: true, date: data.date });
}

async function handleListReadings(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const status = new URL(request.url).searchParams.get('status');
  const requests = status
    ? await listRequestsByStatus(env.FORTUNE_KV, status)
    : await listPendingRequests(env.FORTUNE_KV);
  return Response.json({ ok: true, requests });
}

async function handlePdfUpload(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const skipDelivery = url.searchParams.get('skip_delivery') === '1';
  if (!id) {
    return Response.json({ error: 'id query param required' }, { status: 400 });
  }

  const pdf = await request.arrayBuffer();
  if (!pdf || pdf.byteLength === 0) {
    return Response.json({ error: 'empty body' }, { status: 400 });
  }

  // 30日TTL
  await env.FORTUNE_KV.put(`pdf:${id}`, pdf, { expirationTtl: 30 * 24 * 60 * 60 });

  const downloadUrl = `${url.origin}/pdf/${id}`;

  // 納品先のreading_reqを特定し、自動Push送信＋ステータス更新
  // skip_delivery=1 で明示的にスキップ可能（テスト用）
  let deliveryResult = null;
  if (!skipDelivery) {
    deliveryResult = await deliverReadingToCustomer(env, id, downloadUrl);
  }

  return Response.json({ ok: true, url: downloadUrl, delivery: deliveryResult });
}

// PDFアップロード完了時に顧客にLINE Pushで納品メッセージを送る
// id: reading_req のID（PDFアップロード時の ?id=... と同じIDを使う前提）
async function deliverReadingToCustomer(env, id, pdfUrl) {
  try {
    const req = await getReadingRequest(env.FORTUNE_KV, id);
    if (!req) {
      console.warn('[deliver] reading_req not found for id:', id);
      return { ok: false, error: 'reading_req_not_found' };
    }

    if (req.status === 'delivered') {
      console.log('[deliver] already delivered, skipping push:', id);
      return { ok: true, skipped: 'already_delivered' };
    }

    const deliveryMessage = {
      type: 'flex',
      altText: `${req.name}さんの鑑定書が届きました`,
      contents: buildReadingDelivery(
        req.name,
        req.category_label || '',
        req.subcategory_label || '',
        pdfUrl
      ),
    };

    await pushMessage(req.user_id, [deliveryMessage], env.LINE_CHANNEL_ACCESS_TOKEN);
    await updateRequestStatus(env.FORTUNE_KV, id, 'delivered');

    console.log('[deliver] pushed and marked delivered:', id);
    return { ok: true, userId: req.user_id };
  } catch (error) {
    console.error('[deliver] failed:', error.message);
    return { ok: false, error: error.message };
  }
}

async function handlePdfDownload(id, env) {
  const pdf = await env.FORTUNE_KV.get(`pdf:${id}`, { type: 'arrayBuffer' });
  if (!pdf) {
    return new Response('鑑定書の有効期限が切れました。', { status: 404 });
  }

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="reading-${id}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// ========================================
// Threads関連ハンドラ
// ========================================

async function handleThreadsTokenSave(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!data.access_token || !data.expires_in) {
    return Response.json({ error: 'access_token and expires_in required' }, { status: 400 });
  }

  const saved = await saveInitialToken(env.FORTUNE_KV, data.access_token, data.expires_in);
  return Response.json({ ok: true, fetchedAt: saved.fetchedAt, expiresAt: saved.expiresAt });
}

async function handleThreadsTokenStatus(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const token = await getToken(env.FORTUNE_KV);
    return Response.json({
      ok: true,
      fetchedAt: token.fetchedAt,
      expiresAt: token.expiresAt,
      tokenPrefix: token.accessToken.slice(0, 12) + '...',
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 404 });
  }
}

async function handleThreadsDryRun(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  // リクエストボディで type と meta を指定 → コンテンツ生成のみ実行（投稿しない）
  let data;
  try {
    data = await request.json();
  } catch {
    data = {};
  }

  const { decidePostType } = await import('./threads/scheduler.js');
  const { generateA, generateB, generateC, generateD, generateE, generateF } = await import('./threads/content.js');
  const { loadMoonData } = await import('./threads/assets.js');

  const now = data.simulateTime ? new Date(data.simulateTime) : new Date();
  const moonData = await loadMoonData(env.FORTUNE_KV, now);
  const decision = decidePostType(now, moonData);

  if (decision.type === 'SKIP') {
    return Response.json({ ok: true, decision });
  }

  let content;
  try {
    switch (decision.type) {
      case 'A': content = await generateA({ env, ...decision.meta }); break;
      case 'B': content = await generateB({ env, ...decision.meta }); break;
      case 'C': content = await generateC({ env, ...decision.meta }); break;
      case 'D': content = await generateD({ env, ...decision.meta }); break;
      case 'E': content = await generateE({ env, themeIndex: decision.meta.themeIndex }); break;
      case 'F': content = await generateF({ env, topicIndex: decision.meta.topicIndex }); break;
    }
  } catch (err) {
    return Response.json({ ok: false, decision, error: err.message }, { status: 500 });
  }

  return Response.json({ ok: true, decision, content, charCount: content.text.length });
}

async function handleMoonCalendarUpload(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!data.year || !data.calendar) {
    return Response.json({ error: 'year and calendar required' }, { status: 400 });
  }

  await env.FORTUNE_KV.put(
    `threads:moon_calendar:${data.year}`,
    JSON.stringify(data.calendar)
  );

  return Response.json({ ok: true, year: data.year, entries: Object.keys(data.calendar).length });
}

async function handleUpdateReadingStatus(request, env) {
  const apiKey = request.headers.get('x-api-key') || '';
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!data.id || !data.status) {
    return Response.json({ error: 'id and status required' }, { status: 400 });
  }

  const ALLOWED_STATUSES = ['pending', 'unpaid', 'ready', 'delivered', 'error'];
  if (!ALLOWED_STATUSES.includes(data.status)) {
    return Response.json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 });
  }

  const updated = await updateRequestStatus(env.FORTUNE_KV, data.id, data.status);
  if (!updated) {
    return Response.json({ error: 'request not found' }, { status: 404 });
  }

  return Response.json({ ok: true, request: updated });
}
