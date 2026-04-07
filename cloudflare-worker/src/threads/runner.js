// Threads投稿実行の統括
// scheduled()ハンドラから呼ばれるエントリポイント

import { decidePostType } from './scheduler.js';
import { generateA, generateB, generateC, generateD, generateE, generateF } from './content.js';
import { postThread, refreshLongLivedToken } from './client.js';
import { logPost, alreadyPostedInSlot, getToken, updateToken } from './log.js';
import { resolveImageUrl, loadMoonData } from './assets.js';

// メインランナー：cron発火時に呼ばれる
export async function runScheduledPost(env, scheduledTime) {
  const now = new Date(scheduledTime || Date.now());

  // 月齢データを読み込む（KVに事前投入 or フォールバック）
  const moonData = await loadMoonData(env.FORTUNE_KV, now);

  // 今打つべき投稿タイプを判定
  const decision = decidePostType(now, moonData);
  console.log('[threads-runner] decision:', JSON.stringify(decision));

  if (decision.type === 'SKIP') {
    console.log('[threads-runner] skipped:', decision.reason);
    return { skipped: true, reason: decision.reason };
  }

  // 二重投稿防止
  const already = await alreadyPostedInSlot(env.FORTUNE_KV, { type: decision.type, date: now });
  if (already) {
    console.log('[threads-runner] already posted in slot, skipping');
    return { skipped: true, reason: 'already_posted' };
  }

  // コンテンツ生成
  let content;
  try {
    content = await generateContent(decision, env);
  } catch (error) {
    console.error('[threads-runner] generate failed:', error.message);
    await logPost(env.FORTUNE_KV, {
      type: decision.type,
      text: '',
      postId: null,
      meta: decision.meta,
      error: `generate: ${error.message}`,
    });
    throw error;
  }

  // 画像URL解決（Aは星座画像、Cは月相画像、他はテキストのみ）
  const imageUrl = resolveImageUrl(decision, content, env);

  // トークン取得＆投稿
  let postResult;
  try {
    const tokenRecord = await getToken(env.FORTUNE_KV);
    postResult = await postThread({
      userId: env.THREADS_USER_ID,
      accessToken: tokenRecord.accessToken,
      text: content.text,
      imageUrl,
      waitMs: imageUrl ? 30000 : 5000,
    });
  } catch (error) {
    console.error('[threads-runner] post failed:', error.message);
    await logPost(env.FORTUNE_KV, {
      type: decision.type,
      text: content.text,
      postId: null,
      meta: decision.meta,
      error: `post: ${error.message}`,
    });
    throw error;
  }

  // 成功ログ
  await logPost(env.FORTUNE_KV, {
    type: decision.type,
    text: content.text,
    postId: postResult.postId,
    meta: { ...decision.meta, imageUrl: imageUrl || null },
  });

  console.log('[threads-runner] posted:', postResult.postId);
  return {
    skipped: false,
    type: decision.type,
    postId: postResult.postId,
    text: content.text,
  };
}

// タイプ別にgenerator呼び分け
async function generateContent(decision, env) {
  switch (decision.type) {
    case 'A':
      return generateA({ env, ...decision.meta });
    case 'B':
      return generateB({ env, ...decision.meta });
    case 'C':
      return generateC({ env, ...decision.meta });
    case 'D':
      return generateD({ env, ...decision.meta });
    case 'E':
      return generateE({ env, themeIndex: decision.meta.themeIndex });
    case 'F':
      return generateF({ env, topicIndex: decision.meta.topicIndex });
    default:
      throw new Error(`Unknown decision type: ${decision.type}`);
  }
}

// 週次トークンリフレッシュ（別のcronから呼ばれる）
export async function refreshToken(env) {
  const current = await getToken(env.FORTUNE_KV);
  const refreshed = await refreshLongLivedToken(current.accessToken);
  await updateToken(env.FORTUNE_KV, refreshed.access_token, refreshed.expires_in);
  console.log('[threads-runner] token refreshed, expires in', refreshed.expires_in, 'sec');
  return refreshed;
}
