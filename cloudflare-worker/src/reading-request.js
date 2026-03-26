// Task 5: 鑑定リクエスト管理

const REQUEST_PREFIX = 'reading_req:';
const INDEX_KEY = 'reading_req_index';

function generateId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomDelay() {
  // MVP: 即時配信（cronの間隔で届く）
  // 本番時はコメントを外して 2〜4時間に戻す
  return 0;
  // const minMs = 2 * 60 * 60 * 1000;
  // const maxMs = 4 * 60 * 60 * 1000;
  // return minMs + Math.random() * (maxMs - minMs);
}

export async function saveReadingRequest(kv, data) {
  const id = generateId();
  const now = new Date();
  const deliverAfter = new Date(now.getTime() + randomDelay());

  const request = {
    id,
    user_id: data.userId,
    name: data.name,
    birthday: data.birthday,
    sign: data.sign,
    category: data.category,
    subcategory: data.subcategory,
    category_label: data.categoryLabel,
    subcategory_label: data.subcategoryLabel,
    q1: data.q1,
    q2: data.q2,
    q3: data.q3 || '',
    requested_at: now.toISOString(),
    deliver_after: deliverAfter.toISOString(),
    status: 'pending',
  };

  await kv.put(`${REQUEST_PREFIX}${id}`, JSON.stringify(request));

  // インデックスに追加（pending リクエストの一覧取得用）
  const index = await kv.get(INDEX_KEY, { type: 'json' }) || [];
  index.push(id);
  await kv.put(INDEX_KEY, JSON.stringify(index));

  return request;
}

export async function getReadingRequest(kv, requestId) {
  return kv.get(`${REQUEST_PREFIX}${requestId}`, { type: 'json' });
}

export async function listPendingRequests(kv) {
  return listRequestsByStatus(kv, 'pending');
}

export async function listRequestsByStatus(kv, status) {
  const index = await kv.get(INDEX_KEY, { type: 'json' }) || [];
  const results = [];

  for (const id of index) {
    const req = await kv.get(`${REQUEST_PREFIX}${id}`, { type: 'json' });
    if (req && req.status === status) {
      results.push(req);
    }
  }

  return results;
}

export async function updateRequestStatus(kv, requestId, status) {
  const req = await kv.get(`${REQUEST_PREFIX}${requestId}`, { type: 'json' });
  if (!req) return null;

  req.status = status;
  if (status === 'delivered') {
    req.delivered_at = new Date().toISOString();
  }
  await kv.put(`${REQUEST_PREFIX}${requestId}`, JSON.stringify(req));
  return req;
}
