# LINE対話フロー → AIアウトプット配信 システム構成

## 概要

LINEで段階的にユーザー入力を収集し、AIでコンテンツ生成し、PDF等のアウトプットをLINE配信するパイプライン。

```
[LINEユーザー] ──Webhook──→ [Cloudflare Workers] ──KV──→ [ローカルcron]
                                  │                          │
                             質問フロー                  AI生成 + PDF変換
                             状態管理(KV)                     │
                                  │                     Workers KVにupload
                                  │                          │
                            「受け付けました」          LINE Push で配信
```

## コア構成要素

### 1. LINE対話フロー（ステートマシン）

Webhookで受けたメッセージを、KVに保存した「現在のステップ」に応じて分岐処理する。

**状態遷移の例**:
```
(未登録) → 初期入力 → 登録完了
                        ↓
                  トリガーワード受信
                        ↓
              step1 → step2 → step3 → ... → 完了
                ↑       ↑       ↑
              各ステップで「戻る」可能
```

**実装パターン** (`handlers.js`):
```js
async function handleFlow(kv, userId, text, state) {
  const { step } = state;

  if (step === 'awaiting_XXX') {
    // バリデーション
    // KV状態更新: setFlowState(kv, userId, { step: 'next_step', ...data })
    // Flex Messageで次の質問を返す
  }

  if (step === 'awaiting_YYY') { ... }

  // 最終ステップ: リクエスト保存 → 完了メッセージ返却
}
```

**ポイント**:
- 状態は `flow_state:{userId}` としてKVに保存
- 30分タイムアウトで自動クリア（放置対策）
- 各ステップで `text === '戻る'` をハンドル
- 選択式はFlex Messageボタン、自由入力はテキスト待ち
- 最終ステップで `ctx.waitUntil()` を使い非同期でリクエスト保存（レスポンスを先に返す）

### 2. Cloudflare Workers（API層）

| エンドポイント | 用途 |
|---|---|
| `POST /webhook` | LINE Webhook受信（署名検証必須） |
| `GET /api/requests` | pending リクエスト一覧（API key認証） |
| `POST /api/requests/status` | ステータス更新（API key認証） |
| `POST /api/output/upload` | 生成物アップロード（API key認証） |
| `GET /output/{id}` | 生成物ダウンロード（認証なし、推測不能ID） |

**認証**:
- Webhook: `X-Line-Signature` HMAC-SHA256検証
- 内部API: `X-Api-Key` ヘッダー
- ダウンロード: `crypto.randomUUID()` による推測不能URLで保護

**シークレット管理**: `wrangler secret put` で本番設定、`.env` でローカル開発

### 3. KV ストレージ設計

| キー | 値 | 用途 |
|---|---|---|
| `user:{userId}` | ユーザー属性JSON | 登録情報 |
| `flow_state:{userId}` | `{step, ...収集データ}` | 対話フロー状態（30分TTL相当） |
| `request:{id}` | 全入力データ + status | 生成リクエスト |
| `request_index` | `[id1, id2, ...]` | リクエスト一覧用インデックス |
| `output:{id}` | バイナリ | 生成物（30日TTL） |

**ステータスフロー**:
```
pending → delivered
    ↘ error
```

### 4. 生成・配信パイプライン（ローカルcron）

`deliver.js` を毎時実行:

```
1. GET /api/requests?status=pending
2. 各リクエストに対して:
   a. 収集データからAIプロンプトを構築
   b. AI API呼び出し → 構造化JSON取得
   c. HTMLテンプレートにJSON埋め込み
   d. Playwright (Chromium) で HTML → PDF
   e. POST /api/output/upload でKVに保存
   f. LINE Push API で Flex Message配信（DL URLつき）
   g. POST /api/requests/status → delivered
3. エラー時: status → error
```

**タイムアウト設定**:
- AI生成: 180秒
- PDF変換: 120秒（Chromium初回起動が遅い）

### 5. LINE Flex Message

質問UIもアウトプット配信もFlex Messageを使う。

**質問ステップ用**:
```js
function buildQuestion(label, options) {
  return {
    type: 'bubble',
    body: { /* タイトル */ },
    footer: {
      contents: options.map(opt => ({
        type: 'button',
        action: { type: 'message', label: opt, text: opt }
      }))
    }
  };
}
```

**配信通知用**:
```js
// Push API でユーザーに送信
fetch('https://api.line.me/v2/bot/message/push', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    to: userId,
    messages: [{
      type: 'flex',
      altText: '完成しました',
      contents: { /* DLボタン付きバブル */ }
    }]
  })
});
```

## ファイル構成（参考）

```
project/
├── cloudflare-worker/
│   ├── src/
│   │   ├── index.js          # ルーティング + API認証
│   │   ├── line.js           # 署名検証 + Reply API
│   │   ├── handlers.js       # イベント処理 + フローステートマシン
│   │   ├── kv.js             # KV CRUD
│   │   ├── flow-state.js     # フロー状態管理（タイムアウト付き）
│   │   ├── request.js        # リクエスト保存・インデックス
│   │   ├── questions.js      # 質問データ定義
│   │   └── messages.js       # Flex Message ビルダー
│   ├── wrangler.toml
│   └── package.json
├── scripts/
│   ├── deliver.js            # 配信パイプライン（cron実行）
│   └── generate-output.js    # AI生成 + テンプレート + PDF変換
├── config/
│   └── prompt.md             # AIプロンプト
├── data/
│   └── templates/
│       └── output-template.html
└── .env
```

## 別PJへの流用手順

1. **質問フロー定義**: `questions.js` にカテゴリ・質問・選択肢を定義
2. **Flex Messageデザイン**: `messages.js` でブランドに合わせたUI作成
3. **AIプロンプト作成**: `config/prompt.md` に生成指示を記述
4. **出力テンプレート**: `data/templates/` にHTML作成（PDF/画像等）
5. **Workers デプロイ**: LINE Bot設定 → wrangler secret → wrangler deploy
6. **cron設定**: Claude Code の CronCreate で配信スクリプトを定期実行

## 注意点

- **KVの結果整合性**: read-modify-writeに競合あり。低トラフィック前提
- **Chromium起動**: 初回120秒かかることがある。タイムアウト余裕を持つ
- **LINE Reply Token**: 有効期限短い（数十秒）。重い処理はreply後に `waitUntil` で非同期実行
- **PDF URL**: 認証なしなのでIDの暗号的ランダム性が必須（`crypto.randomUUID()`）
- **配信時間帯**: 深夜配信は避ける（ユーザー体験 + LINE通知）
