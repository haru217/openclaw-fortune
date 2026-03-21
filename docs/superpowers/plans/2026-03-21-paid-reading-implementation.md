# 個別鑑定フロー実装計画

> **Spec:** `docs/superpowers/specs/2026-03-21-paid-reading-flow.md`
> **Prompt OS:** `config/reading-prompt-system.md`

**Goal:** LINE トーク内で個別鑑定を受付 → PDF生成 → 遅延配信するフローを実装する。

**変更点（spec から）:**
- 出生時刻の入力は削除（ハウス非言及のため不要）
- ②のステップが「呼び名入力」のみになる

---

## UXフロー（確定版）

```
① 「個別鑑定」タップ → サービス紹介カード + 「受ける」ボタン
② 「呼び名を教えてください」→ テキスト入力
③ 大項目4つから選択
④ サブメニュー3つから選択
⑤ 構造化質問（Q1選択 + Q2複数選択 + Q3自由記述 + 「このまま鑑定する」）
⑥ 受付完了カード → バックグラウンドでPDF生成 → 2〜4時間後にLINE送信
```

---

## Task 一覧

### Task 1: 質問セットデータ

全12サブメニュー分の Q1/Q2 選択肢を JSON で定義。

- [ ] `cloudflare-worker/src/reading-questions.js` 作成
- [ ] 各サブメニューに `q1Options[]`, `q2Options[]`, `q3Placeholder` を定義
- [ ] テスト: 全12サブメニューにデータがあること

```js
// 構造例
export const READING_QUESTIONS = {
  'career:change': {
    q1: { label: '現在の状況を教えてください', options: [...] },
    q2: { label: '特に知りたいことは？', options: [...], multi: true },
    q3: { placeholder: '例: 4月から新しい会社に入社します...' },
  },
  ...
};
```

### Task 2: 鑑定フロー用 Flex Message

紹介カード、呼び名入力促し、メニュー選択、構造化質問、受付完了の Flex Message を作成。

- [ ] `cloudflare-worker/src/reading-messages.js` 作成
- [ ] `buildReadingIntroCard(baseUrl)` — サービス紹介 + 「受ける」ボタン
- [ ] `buildNamePrompt()` — 呼び名入力促し
- [ ] `buildCategorySelect()` — 大項目4つのボタン
- [ ] `buildSubcategorySelect(category)` — サブメニュー3つのボタン
- [ ] `buildQ1(subcategory)` — Q1 選択ボタン
- [ ] `buildQ2(subcategory)` — Q2 複数選択ボタン + 「その他」
- [ ] `buildQ3(subcategory)` — Q3 自由記述促し + 「このまま鑑定する」ボタン
- [ ] `buildReadingComplete(name, category, subcategory)` — 受付完了カード
- [ ] テスト: 各関数が正しい Flex Message 構造を返すこと

### Task 3: 状態管理

ユーザーが鑑定フローのどのステップにいるかを KV で追跡。

- [ ] `cloudflare-worker/src/reading-state.js` 作成
- [ ] `getReadingState(kv, userId)` — 現在の状態取得
- [ ] `setReadingState(kv, userId, state)` — 状態更新
- [ ] `clearReadingState(kv, userId)` — 状態クリア
- [ ] 状態スキーマ:

```json
{
  "step": "awaiting_name|awaiting_category|awaiting_subcategory|awaiting_q1|awaiting_q2|awaiting_q3",
  "name": "ハル",
  "category": "career",
  "subcategory": "change",
  "q1": "内定済み・入社前",
  "q2": ["人間関係", "成功のポイント"],
  "started_at": "2026-03-21T10:00:00Z"
}
```

- [ ] タイムアウト: 30分経過したら状態リセット
- [ ] テスト: 状態の取得・更新・クリア・タイムアウト

### Task 4: イベントハンドラ拡張

`handlers.js` に鑑定フローの分岐ロジックを追加。

- [ ] `cloudflare-worker/src/handlers.js` 修正
- [ ] reading_state がある場合は鑑定フローに入る
- [ ] 「鑑定を受ける」→ 呼び名入力促し（step: awaiting_name）
- [ ] テキスト入力 → 呼び名保存 → カテゴリ選択（step: awaiting_category）
- [ ] 「鑑定:総合」等 → サブメニュー選択（step: awaiting_subcategory）
- [ ] サブメニュー選択 → Q1（step: awaiting_q1）
- [ ] Q1 回答 → Q2（step: awaiting_q2）
- [ ] Q2 回答 → Q3（step: awaiting_q3）
- [ ] Q3 回答 or 「このまま鑑定する」 → 受付完了 + リクエスト保存
- [ ] 既存の「個別鑑定」テキスト → 紹介カードに変更
- [ ] テスト: 各ステップの遷移が正しいこと

### Task 5: 鑑定リクエスト保存

受付完了時に KV にリクエストを保存。PC 側のバッチが読み取る。

- [ ] `cloudflare-worker/src/reading-request.js` 作成
- [ ] `saveReadingRequest(kv, request)` — リクエスト保存
- [ ] `listPendingRequests(kv)` — pending リクエスト一覧
- [ ] `updateRequestStatus(kv, requestId, status)` — ステータス更新
- [ ] リクエストスキーマ:

```json
{
  "id": "req_xxx",
  "user_id": "Uxxx",
  "name": "ハル",
  "birthday": "1987-08-17",
  "sign": "leo",
  "life_path": 5,
  "personal_year": 8,
  "category": "career",
  "subcategory": "change",
  "q1": "内定済み・入社前",
  "q2": ["人間関係", "成功のポイント", "注意すべきこと"],
  "q3": "4月から新しい会社に入社するので...",
  "tarot_card": { "id": 7, "name": "戦車", "reversed": false },
  "requested_at": "2026-03-21T10:05:00Z",
  "deliver_after": "2026-03-21T13:05:00Z",
  "status": "pending"
}
```

- [ ] テスト: 保存・一覧・ステータス更新

### Task 6: Workers デプロイ + E2E テスト

Task 1-5 を統合して Workers にデプロイ。LINE で実際にフローを通す。

- [ ] `npx wrangler deploy`
- [ ] LINE で「個別鑑定」→ 紹介カード表示
- [ ] 「受ける」→ 呼び名入力 → カテゴリ → サブメニュー → Q1 → Q2 → Q3 → 受付完了
- [ ] KV にリクエストが保存されたことを確認

### Task 7: PDF 生成スクリプト（PC 側）

HTML テンプレート + Playwright で PDF を生成するスクリプト。

- [ ] `scripts/fortune/generate-reading-pdf.js` 作成
- [ ] HTML テンプレート（`data/templates/reading-template.html`）作成
  - モックアップ `reading-test1-haru-v2.html` をテンプレート化
  - `{{name}}`, `{{sign}}` 等のプレースホルダー
- [ ] リクエストデータ → テンプレート変数に変換
- [ ] 数秘術計算（`lib/numerology.js`）
- [ ] 天文データ注入（`data/moon-phases-2026.json`, `data/ephemeris-2026.json`）
- [ ] klaw にプロンプト OS + 変数を渡して鑑定文を生成
- [ ] HTML に鑑定文を挿入 → Playwright で PDF 変換
- [ ] テスト: テストデータで PDF が正しく生成されること

### Task 8: 配信スクリプト（PC 側）

pending リクエストを検出し、deliver_after を過ぎたものを LINE Push Message で配信。

- [ ] `scripts/fortune/deliver-readings.js` 作成
- [ ] Workers API から pending リクエストを取得
- [ ] deliver_after を過ぎたものだけ処理
- [ ] PDF を LINE Push Message で送信（ファイルアップロード）
- [ ] ステータスを `delivered` に更新
- [ ] cron 追加: 15分間隔で実行
- [ ] テスト: 配信フローの動作確認

### Task 9: 紹介カードの内容確定

spec の「サービス紹介カード」の文言を確定。

- [ ] 何が得られるかを具体的に記載
- [ ] 「西洋占星術 × 数秘術 × タロットの3軸鑑定」
- [ ] 「PDF鑑定書をお届けします」
- [ ] 「鑑定結果は数時間後にお届け」
- [ ] 価格は記載しない（Stripe 後付け）

---

## 実装順序

```
Task 1 (質問データ)  ─┐
Task 2 (Flex Message) ─┤─→ Task 4 (ハンドラ) ─→ Task 6 (デプロイ+E2E)
Task 3 (状態管理)    ─┤
Task 5 (リクエスト)  ─┘
                                                 Task 7 (PDF生成) ─→ Task 8 (配信)
Task 9 (紹介カード文言) は Task 2 と並行
```

Task 1-5 は独立して作れるので並行実装可能。Task 6 で統合。Task 7-8 は PC 側なので Workers とは別。
