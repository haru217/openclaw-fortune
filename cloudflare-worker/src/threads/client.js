// Threads Graph API クライアント
// docs: https://developers.facebook.com/docs/threads

const THREADS_API = 'https://graph.threads.net/v1.0';

// メディアコンテナ作成（Step 1）
// type: 'TEXT' | 'IMAGE'
export async function createContainer({ userId, accessToken, text, mediaType = 'TEXT', imageUrl = null }) {
  const params = new URLSearchParams();
  params.set('media_type', mediaType);
  params.set('text', text);
  if (mediaType === 'IMAGE' && imageUrl) {
    params.set('image_url', imageUrl);
  }
  params.set('access_token', accessToken);

  const res = await fetch(`${THREADS_API}/${userId}/threads`, {
    method: 'POST',
    body: params,
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`createContainer failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.id;
}

// コンテナ公開（Step 2）
// Metaは作成から約30秒の処理時間を推奨。呼び出し側でawaitすること。
export async function publishContainer({ userId, accessToken, containerId }) {
  const params = new URLSearchParams();
  params.set('creation_id', containerId);
  params.set('access_token', accessToken);

  const res = await fetch(`${THREADS_API}/${userId}/threads_publish`, {
    method: 'POST',
    body: params,
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`publishContainer failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.id;
}

// コンテナのステータス取得（FINISHED / IN_PROGRESS / ERROR / EXPIRED / PUBLISHED）
export async function getContainerStatus({ accessToken, containerId }) {
  const url = new URL(`${THREADS_API}/${containerId}`);
  url.searchParams.set('fields', 'status,error_message');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`getContainerStatus failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

// 投稿（2ステップをまとめた便利関数、status pollingで wall-clock 節約）
export async function postThread({ userId, accessToken, text, imageUrl = null, maxWaitMs = 20000, pollIntervalMs = 2000 }) {
  const mediaType = imageUrl ? 'IMAGE' : 'TEXT';
  const containerId = await createContainer({ userId, accessToken, text, mediaType, imageUrl });

  // テキストのみならほぼ即座にFINISHEDになる。画像は数秒〜十数秒。
  // 固定waitではなくpollingして早期公開する（Workers wall-clock節約）
  const startedAt = Date.now();
  let lastStatus = null;
  while (Date.now() - startedAt < maxWaitMs) {
    await sleep(pollIntervalMs);
    const status = await getContainerStatus({ accessToken, containerId });
    lastStatus = status.status;
    if (status.status === 'FINISHED') break;
    if (status.status === 'ERROR' || status.status === 'EXPIRED') {
      throw new Error(`Container ${status.status}: ${status.error_message || 'unknown'}`);
    }
  }

  if (lastStatus !== 'FINISHED') {
    throw new Error(`Container not ready after ${maxWaitMs}ms (last status: ${lastStatus})`);
  }

  const postId = await publishContainer({ userId, accessToken, containerId });
  return { postId, containerId };
}

// Long-lived token リフレッシュ（60日間有効、24h経過後から交換可能）
export async function refreshLongLivedToken(accessToken) {
  const url = new URL(`${THREADS_API}/refresh_access_token`);
  url.searchParams.set('grant_type', 'th_refresh_token');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`refreshLongLivedToken failed: ${res.status} ${JSON.stringify(body)}`);
  }
  // { access_token, token_type, expires_in }
  return body;
}

// Short-lived → Long-lived 交換（初回OAuth直後）
export async function exchangeForLongLivedToken({ shortLivedToken, appSecret }) {
  const url = new URL(`${THREADS_API}/access_token`);
  url.searchParams.set('grant_type', 'th_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortLivedToken);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`exchangeForLongLivedToken failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
