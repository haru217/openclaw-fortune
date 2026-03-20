# Cloudflare Workers 移行設計書

## 概要

openclaw-fortune の LINE webhook サーバーを Express (localhost) から Cloudflare Workers に移行する。固定URL・24時間応答・無料運用を実現する。

## 現状の課題

- cloudflared クイックトンネルは毎回URLが変わる
- PC がオフだと LINE webhook に応答できない
- URL が変わるたびに .env と LINE 管理画面の更新が必要

## 移行後のアーキテクチャ

### Workers（常時稼働・固定URL）

LINE webhook を受信し、KV から占い・ユーザーデータを読み書きして LINE Reply API で応答する。LINE Bot SDK は使わず、署名検証・API 呼び出しを `fetch` + `crypto.subtle` で自前実装する（Edge Runtime 互換性のため）。

### PC 側バッチ（毎朝定時）

klaw Gateway で12星座分の占いテキストを生成し、Workers の API エンドポイント経由で KV に保存する。Windows タスクスケジューラで毎朝定時実行。

### データフロー

```
朝バッチ(PC) → klaw → JSON生成 → POST /api/daily → Workers → KV保存
ユーザー(LINE) → webhook → Workers → KV読み取り → LINE Reply API
```

## KV データ構造

**KV Namespace: `FORTUNE_KV`**

| Key パターン | Value | 用途 |
|-------------|-------|------|
| `daily:{YYYY-MM-DD}` | `{ fortunes: { aries: { sign, message, card: { id, name, reversed } }, ... }, generated_at }` | 日次占いデータ |
| `user:{LINE userId}` | `{ sign, birthday, registered_at, view_count }` | ユーザーデータ |

- 日次データは現行の `data/daily/{date}.json` と同じ構造
- ユーザーは個別キーに分離（現行の全ユーザー1ファイルから変更）

## Workers エンドポイント

| メソッド | パス | 認証 | 用途 |
|----------|------|------|------|
| `POST` | `/webhook` | LINE署名検証 | LINE webhook 受信→イベント処理→Reply API |
| `POST` | `/api/daily` | APIキー（`X-Api-Key` ヘッダー） | バッチからの占いデータ書き込み |
| `GET` | `/health` | なし | ヘルスチェック |

## LINE 署名検証

```js
async function verifySignature(body, signature, channelSecret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}
```

## LINE Reply API 呼び出し

```js
async function replyMessage(replyToken, messages, channelAccessToken) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}
```

## 画像ホスティング

タロット画像22枚 + welcome-hero.jpg は Cloudflare R2（無料オブジェクトストレージ）に配置する。R2 バケットのパブリックアクセスを有効にし、パブリック URL を Flex Message の画像 URL に直接指定する（Workers バインディング経由の配信はしない）。

## ファイル構成

```
openclaw-fortune/
├── cloudflare-worker/          # 新規
│   ├── wrangler.toml           # Workers 設定（KV/R2 バインディング）
│   ├── src/
│   │   ├── index.js            # エントリポイント（ルーティング）
│   │   ├── line.js             # 署名検証・Reply API
│   │   ├── handlers.js         # イベントハンドラ（follow, message等）
│   │   ├── kv.js               # KV 読み書きヘルパー
│   │   └── flex-messages.js    # Flex Message ビルダー（lib/ から移植）
│   └── test/                   # Workers ハンドラのテスト
├── scripts/fortune/
│   ├── batch-fortune.js        # 既存（出力先を Workers API に変更）
│   └── upload-assets.js        # 新規（画像を R2 にアップロード）
├── lib/                        # 既存（バッチ処理で引き続き使用）
└── ...
```

## 環境変数

### Workers Secrets（`wrangler secret put` で設定）

| 変数名 | 用途 |
|--------|------|
| `LINE_CHANNEL_SECRET` | webhook 署名検証 |
| `LINE_CHANNEL_ACCESS_TOKEN` | Reply API 認証 |
| `API_KEY` | バッチ書き込み認証 |

### PC 側 `.env`（バッチスクリプト用）

| 変数名 | 用途 |
|--------|------|
| `WORKER_URL` | Workers の固定 URL（例: `https://openclaw-fortune.xxx.workers.dev`） |
| `API_KEY` | Workers の `/api/daily` 認証用（Workers 側と同じ値） |
| `KLAW_GATEWAY_URL` | klaw Gateway（既存、`http://localhost:18789`） |

## バッチスクリプトの変更

現行の `batch-fortune.js` は `data/daily/{date}.json` にファイル出力している。移行後は klaw でテキスト生成後、Workers の `POST /api/daily` に HTTP で送信する。

```js
// 変更後のイメージ
const result = generateFortunes(); // klaw 呼び出し
await fetch(`${WORKER_URL}/api/daily`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
  body: JSON.stringify({ date: today, fortunes: result }),
});
```

## 移行手順

1. Cloudflare Workers プロジェクト作成（wrangler.toml, KV namespace, R2 bucket）
2. Workers スクリプト実装（署名検証、ハンドラ、KV操作、Flex Messages）
3. 画像を R2 にアップロード
4. `wrangler deploy` → 固定 URL 取得
5. LINE 管理画面の webhook URL を Workers URL に変更
6. batch-fortune.js の出力先を Workers API に変更
7. Windows タスクスケジューラでバッチ定時実行を設定
8. E2E テスト（follow→登録→占い→個別鑑定）
9. cloudflared / Express サーバーを廃止

## スコープ外

- Stripe 決済連携（別フェーズ）
- ステップ配信（別フェーズ）
- LP 作成（別フェーズ）
