// Threads投稿ログ（KV）
// 重複投稿防止・分析・トークンリフレッシュ状況の管理

const LOG_TTL = 90 * 24 * 60 * 60; // 90日

// 投稿実行を記録（同じ時間帯の重複防止キーにもなる）
export async function logPost(kv, { type, text, postId, meta, error = null }) {
  const now = new Date();
  const isoDate = now.toISOString();
  const dateKey = isoDate.slice(0, 10); // YYYY-MM-DD
  const timeKey = isoDate.slice(11, 16).replace(':', ''); // HHmm

  const key = `threads:post_log:${dateKey}:${timeKey}:${type}`;
  const value = {
    type,
    text,
    postId,
    meta,
    error,
    postedAt: isoDate,
  };

  await kv.put(key, JSON.stringify(value), { expirationTtl: LOG_TTL });

  // 日別インデックスも更新（分析用）
  const indexKey = `threads:post_index:${dateKey}`;
  const existing = await kv.get(indexKey, { type: 'json' }) || [];
  existing.push({ type, time: timeKey, postId, error: !!error });
  await kv.put(indexKey, JSON.stringify(existing), { expirationTtl: LOG_TTL });
}

// 同じ時間帯に既に投稿済みか（多重発火対策）
export async function alreadyPostedInSlot(kv, { type, date }) {
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const dateKey = jstDate.toISOString().slice(0, 10);

  const indexKey = `threads:post_index:${dateKey}`;
  const existing = await kv.get(indexKey, { type: 'json' }) || [];
  return existing.some((entry) => entry.type === type && !entry.error);
}

// 初回トークン投入（scripts/threads-oauth.jsから叩かれる想定）
export async function saveInitialToken(kv, token, expiresInSec) {
  const now = Date.now();
  const value = {
    accessToken: token,
    fetchedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + expiresInSec * 1000).toISOString(),
  };
  await kv.put('threads:access_token', JSON.stringify(value));
  return value;
}

export async function getToken(kv) {
  const raw = await kv.get('threads:access_token', { type: 'json' });
  if (!raw) throw new Error('Threads access token not found in KV');
  return raw;
}

export async function updateToken(kv, newToken, expiresInSec) {
  return saveInitialToken(kv, newToken, expiresInSec);
}
