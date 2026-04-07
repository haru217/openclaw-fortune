# 引き継ぎ: 2026-04-08 セッション

## 今回の変更概要

### 1. Threads自動投稿モジュール（新規）
Threads Graph APIを使った自動マーケティング投稿システムを実装。

**新規ファイル:**
- `cloudflare-worker/src/threads/client.js` — Threads API HTTPクライアント（container status polling方式）
- `cloudflare-worker/src/threads/templates.js` — 6投稿フォーマット（A〜F）のプロンプトテンプレート
- `cloudflare-worker/src/threads/content.js` — GPT-5.4によるコンテンツ生成（OpenAI API、JSON mode）
- `cloudflare-worker/src/threads/scheduler.js` — 投稿タイプ決定ロジック（JST時間帯、月齢、段階的プロモ）
- `cloudflare-worker/src/threads/log.js` — KVベースの投稿ログ・重複排除・トークン管理
- `cloudflare-worker/src/threads/assets.js` — 画像URL解決（星座・月相）、月齢カレンダーKVロード
- `cloudflare-worker/src/threads/runner.js` — オーケストレーション（decide→generate→post→log）
- `cloudflare-worker/scripts/threads-oauth.js` — ローカルOAuthトークン取得スクリプト
- `cloudflare-worker/THREADS_SETUP.md` — セットアップ手順書

**投稿フォーマット:**
| Type | 内容 | 頻度 |
|------|------|------|
| A | 今日の星座ミニ占い | 毎朝 |
| B | 月曜テーマ占い | 週1 |
| C | 新月/満月メッセージ | 月2回 |
| D | 土曜トリビア | 週1 |
| E | 平日共感ポスト | 週3 |
| F | 日曜プロモ（個別鑑定告知）| M2以降週1 |

**段階的プロモ方針:** M1=プロモなし / M2=隔週 / M3+=毎週

### 2. LINE導線修正（Phase 1 P0）

**修正ファイル:**
- `cloudflare-worker/src/handlers.js` — postbackイベント対応追加（テキストメッセージと統合処理）
- `cloudflare-worker/src/line.js` — pushMessage()関数追加（能動送信用Push API）
- `cloudflare-worker/src/reading-messages.js` — 価格表示「1,980円（税込）」、納品時間「24時間以内」、支払い方法案内追加
- `cloudflare-worker/src/index.js` — Threads cron統合、PDF自動納品（deliverReadingToCustomer）、4つのAPI endpoint追加
- `scripts/fortune/deliver-readings.js` — skip_delivery=1追加（二重Push防止）
- `cloudflare-worker/wrangler.toml` — cron triggers 6件追加

### 3. Workers scheduled()ハンドラ
`index.js`にcron振り分けロジック追加:
- 通常cron → Threads投稿
- `0 3 * * 1` → 週次トークンリフレッシュ

## 未着手タスク

### すぐやるべき（ブロッカー）
1. **Meta Developer App登録** — 新デバイスロック中。24-48時間後に再試行
2. **PAY.JP決済統合** — unpaid→pending遷移のWebhook実装（Phase 3）

### 次にやるべき
3. `generate-reading-pdf.js` が現行データスキーマで動くか検証
4. `deliver-readings.js` のcron設定確認
5. Threads OAuthトークン取得 → KV保存（Meta App登録後）
6. Workers環境変数設定: `THREADS_USER_ID`, `OPENAI_API_KEY`（wrangler secret put）

### 後回しでOK
7. 月齢カレンダーデータ投入（`/api/threads/moon`）
8. Threads投稿の画像素材準備（星座アイコン等）
9. LINE リッチメニュー改善

## 環境変数（要設定）
```
# Workers secrets (wrangler secret put)
THREADS_USER_ID=<Threads Graph API user ID>
OPENAI_API_KEY=<GPT-5.4用>

# 既存（設定済み）
LINE_CHANNEL_SECRET=***
LINE_CHANNEL_ACCESS_TOKEN=***
API_KEY=***
```

## テスト方法
- Threads dryrun: `POST /api/threads/dryrun` （投稿せずコンテンツ生成のみ）
- scheduler単体テスト: `node -e "..."` で decidePostType の戻り値確認済み（9ケースPASS）
