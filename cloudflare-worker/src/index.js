import { verifySignature, replyMessage } from './line.js';
import { handleEvent } from './handlers.js';
import { saveDailyFortune } from './kv.js';
import { listPendingRequests, updateRequestStatus } from './reading-request.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok' });
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
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

    return new Response('Not Found', { status: 404 });
  },
};

async function handleWebhook(request, env) {
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
      const messages = await handleEvent(event, env);
      if (messages.length > 0 && event.replyToken) {
        await replyMessage(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
      }
    } catch (error) {
      console.error('[webhook] Event error:', error.message);
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

  const pending = await listPendingRequests(env.FORTUNE_KV);
  return Response.json({ ok: true, requests: pending });
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

  const updated = await updateRequestStatus(env.FORTUNE_KV, data.id, data.status);
  if (!updated) {
    return Response.json({ error: 'request not found' }, { status: 404 });
  }

  return Response.json({ ok: true, request: updated });
}
