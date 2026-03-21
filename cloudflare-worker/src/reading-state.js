// Task 3: 鑑定フロー状態管理

const STATE_PREFIX = 'reading_state:';
const TIMEOUT_MS = 30 * 60 * 1000; // 30分

export async function getReadingState(kv, userId) {
  const state = await kv.get(`${STATE_PREFIX}${userId}`, { type: 'json' });
  if (!state) return null;

  // タイムアウトチェック
  const elapsed = Date.now() - new Date(state.started_at).getTime();
  if (elapsed > TIMEOUT_MS) {
    await clearReadingState(kv, userId);
    return null;
  }

  return state;
}

export async function setReadingState(kv, userId, updates) {
  const current = await kv.get(`${STATE_PREFIX}${userId}`, { type: 'json' }) || {};
  const state = {
    ...current,
    ...updates,
    started_at: current.started_at || new Date().toISOString(),
  };
  await kv.put(`${STATE_PREFIX}${userId}`, JSON.stringify(state));
  return state;
}

export async function clearReadingState(kv, userId) {
  await kv.delete(`${STATE_PREFIX}${userId}`);
}
