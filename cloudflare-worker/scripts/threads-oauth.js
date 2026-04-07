#!/usr/bin/env node
// Threads OAuth初回トークン取得スクリプト
// Meta Developer Appが登録済み・テスター承認済みの前提で、ローカルで1回だけ実行する。
//
// 使い方:
//   1. .env に THREADS_APP_ID, THREADS_APP_SECRET, WORKERS_API_KEY, WORKERS_BASE_URL を設定
//   2. `node scripts/threads-oauth.js authorize` → ブラウザで認可URLを開く
//   3. リダイレクト先のURLから ?code=xxx をコピー
//   4. `node scripts/threads-oauth.js exchange <CODE>` → long-lived token 取得 → Workersに保存
//
// 参考: https://developers.facebook.com/docs/threads/get-started/get-access-tokens-and-permissions

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env を読む（シンプルパース）
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    const env = {};
    for (const line of content.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return env;
  } catch {
    return {};
  }
}

const env = { ...loadEnv(), ...process.env };
const APP_ID = env.THREADS_APP_ID;
const APP_SECRET = env.THREADS_APP_SECRET;
const REDIRECT_URI = env.THREADS_REDIRECT_URI || 'https://localhost/';
const WORKERS_API_KEY = env.WORKERS_API_KEY || env.API_KEY;
const WORKERS_BASE_URL = env.WORKERS_BASE_URL || 'https://openclaw-fortune.<account>.workers.dev';

function ensureEnv() {
  if (!APP_ID || !APP_SECRET) {
    console.error('ERROR: THREADS_APP_ID と THREADS_APP_SECRET を .env に設定してください');
    process.exit(1);
  }
}

async function main() {
  const [, , cmd, ...args] = process.argv;

  if (cmd === 'authorize') {
    ensureEnv();
    const authUrl = new URL('https://threads.net/oauth/authorize');
    authUrl.searchParams.set('client_id', APP_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', 'threads_basic,threads_content_publish');
    authUrl.searchParams.set('response_type', 'code');

    console.log('\n=== Step 1: 以下のURLをブラウザで開いて認可してください ===\n');
    console.log(authUrl.toString());
    console.log('\n認可後にリダイレクトされるURLの ?code=xxx をコピーして、次のコマンドを実行:');
    console.log('  node scripts/threads-oauth.js exchange <CODE>\n');
    return;
  }

  if (cmd === 'exchange') {
    ensureEnv();
    const code = args[0];
    if (!code) {
      console.error('ERROR: code を引数に指定してください');
      console.error('  例: node scripts/threads-oauth.js exchange AQAD...#_');
      process.exit(1);
    }

    // #_ がついてることが多いので除去
    const cleanCode = code.replace(/#_$/, '');

    console.log('[1/3] code → short-lived token 交換中...');
    const shortRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code: cleanCode,
      }),
    });
    const shortBody = await shortRes.json();
    if (!shortRes.ok) {
      console.error('short-lived token取得失敗:', JSON.stringify(shortBody, null, 2));
      process.exit(1);
    }
    console.log('  ✓ short-lived取得、user_id:', shortBody.user_id);

    console.log('[2/3] short → long-lived token 交換中...');
    const longUrl = new URL('https://graph.threads.net/access_token');
    longUrl.searchParams.set('grant_type', 'th_exchange_token');
    longUrl.searchParams.set('client_secret', APP_SECRET);
    longUrl.searchParams.set('access_token', shortBody.access_token);
    const longRes = await fetch(longUrl);
    const longBody = await longRes.json();
    if (!longRes.ok) {
      console.error('long-lived token取得失敗:', JSON.stringify(longBody, null, 2));
      process.exit(1);
    }
    console.log('  ✓ long-lived取得、expires_in:', longBody.expires_in, 'sec');

    console.log('[3/3] Workers KV に保存中...');
    if (!WORKERS_API_KEY || WORKERS_BASE_URL.includes('<account>')) {
      console.warn('  ⚠ WORKERS_API_KEY または WORKERS_BASE_URL が未設定のため KV保存をスキップ');
      console.log('\n=== 取得結果（手動で保存してください） ===');
      console.log('THREADS_USER_ID=', shortBody.user_id);
      console.log('access_token=', longBody.access_token);
      console.log('expires_in=', longBody.expires_in);
      return;
    }

    const saveRes = await fetch(`${WORKERS_BASE_URL}/api/threads/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKERS_API_KEY,
      },
      body: JSON.stringify({
        access_token: longBody.access_token,
        expires_in: longBody.expires_in,
      }),
    });
    const saveBody = await saveRes.json();
    if (!saveRes.ok) {
      console.error('Workers保存失敗:', JSON.stringify(saveBody, null, 2));
      process.exit(1);
    }
    console.log('  ✓ Workers KVに保存完了、expiresAt:', saveBody.expiresAt);

    console.log('\n=== 完了 ===');
    console.log('次のステップ:');
    console.log(`  1. wrangler secret put THREADS_USER_ID → ${shortBody.user_id} を入力`);
    console.log('  2. wrangler secret put OPENAI_API_KEY → OpenAI APIキーを入力');
    console.log('  3. wrangler deploy');
    console.log('  4. /api/threads/dryrun を叩いて動作確認');
    return;
  }

  console.log('使い方:');
  console.log('  node scripts/threads-oauth.js authorize          # 認可URL表示');
  console.log('  node scripts/threads-oauth.js exchange <CODE>    # token交換＆保存');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
