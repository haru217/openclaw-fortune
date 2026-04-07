function toBase64(bytes) {
  if (typeof btoa === 'function') {
    return btoa(String.fromCharCode(...bytes));
  }
  return Buffer.from(bytes).toString('base64');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

/**
 * LINE webhook署名検証（crypto.subtle使用 — Edge Runtime互換）
 */
async function verifySignature(body, signature, channelSecret) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expected = toBase64(new Uint8Array(signed));
    return constantTimeEqual(expected, signature);
  } catch {
    return false;
  }
}

function buildReplyBody(replyToken, messages) {
  return { replyToken, messages };
}

/**
 * LINE Reply API 呼び出し
 */
async function replyMessage(replyToken, messages, channelAccessToken) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify(buildReplyBody(replyToken, messages)),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[line] Reply API error:', response.status, text);
  }

  return response;
}

/**
 * LINE Push API 呼び出し（能動送信）
 * reply tokenが使えない非同期納品時に使用
 */
async function pushMessage(to, messages, channelAccessToken) {
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[line] Push API error:', response.status, text);
    throw new Error(`LINE Push API failed: ${response.status} ${text}`);
  }

  return response;
}

export { verifySignature, replyMessage, pushMessage, buildReplyBody };
