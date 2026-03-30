import { verifySignature, replyMessage } from './line.js';
import { handleEvent } from './handlers.js';
import { saveDailyFortune } from './kv.js';
import { listPendingRequests, listRequestsByStatus, updateRequestStatus } from './reading-request.js';

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

    return new Response('Not Found', { status: 404 });
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

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'id query param required' }, { status: 400 });
  }

  const pdf = await request.arrayBuffer();
  if (!pdf || pdf.byteLength === 0) {
    return Response.json({ error: 'empty body' }, { status: 400 });
  }

  // 30日TTL
  await env.FORTUNE_KV.put(`pdf:${id}`, pdf, { expirationTtl: 30 * 24 * 60 * 60 });

  const downloadUrl = `${new URL(request.url).origin}/pdf/${id}`;
  return Response.json({ ok: true, url: downloadUrl });
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
