# Threads投稿モジュール セットアップ手順

Meta Developer Appの登録が解除されたら、以下の順で進める。

## 前提
- Meta Developer Appが作成済み
- App ID / App Secret を取得済み
- 占い専用Threadsアカウントがテスター登録承認済み
- Redirect URI `https://localhost/` が設定済み

## 1. 環境変数ファイル作成

`cloudflare-worker/.env` (gitignore済みのはず、未追加なら追加)

```
THREADS_APP_ID=<App ID>
THREADS_APP_SECRET=<App Secret>
THREADS_REDIRECT_URI=https://localhost/
WORKERS_API_KEY=<既存のAPI_KEY>
WORKERS_BASE_URL=https://openclaw-fortune.<your-subdomain>.workers.dev
```

## 2. OAuth認可フロー（1回だけ）

```bash
cd cloudflare-worker
node scripts/threads-oauth.js authorize
```

→ 表示されたURLをブラウザで開く → 占い専用Threadsでログイン → 許可
→ `https://localhost/?code=AQD...#_` にリダイレクトされる（接続エラー表示はOK）
→ URLの `code=` 以降をコピー

```bash
node scripts/threads-oauth.js exchange <コピーしたコード>
```

→ short-lived token → long-lived token → Workers KV保存まで自動実行される
→ 末尾に表示される `THREADS_USER_ID` を控える

## 3. Workers secrets設定

```bash
wrangler secret put THREADS_USER_ID
# → 上で控えたユーザーIDを入力

wrangler secret put OPENAI_API_KEY
# → OpenAI APIキー（gpt-5.4アクセス可能なもの）を入力
```

## 4. デプロイ

```bash
wrangler deploy
```

## 5. 動作確認（ドライラン）

投稿せずにコンテンツ生成だけ確認:

```bash
curl -X POST "https://openclaw-fortune.<subdomain>.workers.dev/api/threads/dryrun" \
  -H "x-api-key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"simulateTime": "2026-04-06T22:00:00Z"}'
```

`simulateTime` を変えて各フォーマット(A-F)の生成を確認できる:
- `2026-04-06T22:00:00Z` → Aタイプ（火曜朝7:00 JST）
- `2026-04-05T22:30:00Z` → Bタイプ（月曜朝7:30 JST）
- `2026-04-08T12:00:00Z` → Eタイプ（水曜21:00 JST）
- `2026-04-11T02:00:00Z` → Fタイプ（土曜11:00 JST）

## 6. 月齢カレンダー投入

新月・満月の日にCタイプに切り替わるよう、月齢データを入れる:

```bash
curl -X POST "https://openclaw-fortune.<subdomain>.workers.dev/api/threads/moon" \
  -H "x-api-key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2026,
    "calendar": {
      "2026-04-08": {"type": "new", "sign": "牡羊座"},
      "2026-04-23": {"type": "full", "sign": "蠍座"},
      "2026-05-07": {"type": "new", "sign": "牡牛座"},
      "2026-05-23": {"type": "full", "sign": "射手座"}
    }
  }'
```

## 7. 画像アセット配置（任意、初期は未配置で動く）

GitHub repoの `assets/threads/` 配下に配置:
- `assets/threads/zodiac/{aries,taurus,...}.jpg` (12個)
- `assets/threads/moon/{new_moon,full_moon}_{aries,taurus,...}.jpg`

配置されていない場合は画像なしのテキスト投稿にフォールバックする。

## 8. 本番実投稿テスト

ドライラン成功後、実投稿テスト用に手動cronトリガー:

```bash
# 手動でscheduled eventを叩く（wrangler dev --test-scheduled）
wrangler dev --test-scheduled
```

別ターミナルで:
```bash
curl "http://localhost:8787/__scheduled?cron=0+12+*+*+2"  # 火曜21:00 JST相当
```

## 9. Cron自動起動

`wrangler deploy` 済みなら cron triggers が自動的に有効化される。ダッシュボードで `Workers & Pages > openclaw-fortune > Triggers` に以下が表示されるはず:

- `0 22 * * *` (daily morning)
- `30 22 * * 0` (monday theme)
- `0 2 * * 6` (saturday trivia)
- `0 12 * * 2,3,4` (weekday empathy)
- `0 11 * * 0` (sunday promo)
- `0 3 * * 1` (token refresh)

## トラブルシュート

### `Container not ready after 20000ms`
→ 画像URLがpublicでない可能性。GitHub rawのURLをブラウザで直接アクセスして確認。

### `OpenAI API failed: 401`
→ `wrangler secret put OPENAI_API_KEY` で再設定。

### `Threads access token not found in KV`
→ OAuthフロー(Step 2)が完了していない。`threads-oauth.js exchange` を再実行。

### トークンの期限切れ（60日後）
→ 月曜3:00 UTCのリフレッシュcronが自動で更新。手動更新する場合:
```bash
curl -X POST "https://openclaw-fortune.<subdomain>.workers.dev/__scheduled?cron=0+3+*+*+1"
```
