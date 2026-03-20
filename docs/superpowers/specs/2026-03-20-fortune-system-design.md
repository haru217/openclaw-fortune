# openclaw-fortune システム設計書

## 1. プロジェクト概要

占い自動マネタイズシステム。LINE公式アカウントを中核に、Threads/note/ココナラで集客し、Stripe決済で課金する。klaw（GPT-5.4）がテキスト生成を全担当し、Node.jsスクリプトがAPI連携を行う。人間の介入ゼロで運用する。

### MVPスコープ

**MVPはsenta個人のテスト用。公開しない。**

- LINE公式アカウントをsentaだけが友だち登録
- 毎日の占い生成→LINEリプライが動くことを確認
- Threads/note/ココナラ/Stripeは MVP外（Phase 1以降）
- 目的: パイプラインの動作確認とコンテンツ品質の検証

## 2. ペルソナ

| 項目 | 内容 |
|------|------|
| 名前 | カイ｜あなたの星を読みます |
| 性別・年齢 | 男性・30代後半 |
| トーン | 知的・落ち着き・信頼感・神秘的だが派手でない |
| 占術 | 西洋占星術 + タロット |
| プロフィール画像 | 夜景写真（`assets/profile-icon.jpg`） |
| キャラクターイラスト | 不使用 |
| AI使用の開示 | しない（日本現行法で義務なし） |
| 免責表現 | 「星とカードからのメッセージです」（世界観を壊さない自然な表現） |
| 「エンターテインメント」 | 使わない |

設定ファイル: `config/character.yaml`

## 3. 分類軸

| レイヤー | 方式 | 表示 |
|----------|------|------|
| 毎日の無料占い | 12星座（内部） | ユーザーには星座を見せない。「あなたへのメッセージ」として提示 |
| 有料個別鑑定 | 星座 × 数秘術 | 組み合わせ結果を提示（表で分類名は見せない） |

## 4. アーキテクチャ

```
klaw (GPT-5.4)                   Node.js スクリプト
 ├─ 朝バッチ: 12星座分一括生成    ├─ scripts/fortune/batch-fortune.js (cron)
 │   → data/daily/{date}.json    ├─ scripts/fortune/server.js (Express webhook)
 │                                ├─ scripts/fortune/line-broadcast.js (週1)
 └─ 有料鑑定: Gateway API経由     └─ scripts/fortune/paid-reading.js (キュー)
     → 個別生成 (30-60秒)
```

**注**: スクリプトは `scripts/fortune/` サブディレクトリに配置（`schedule.yaml` と統一）。

### データフロー

1. **朝バッチ** (cron, 毎朝6:00)
   - klawに12星座分の占いテキスト生成を依頼
   - 結果を `data/daily/YYYY-MM-DD.json` に保存
   - 各星座: 本日の運勢（100-150字）+ ラッキーアイテム

2. **LINEリプライ** (webhook, 常時)
   - ユーザーがリッチメニュー「今日の占い」タップ
   - ユーザーの登録星座で `data/daily/` から即レス（LLM呼び出しなし）
   - 未登録ユーザー → 星座登録フローへ誘導

3. **週間ブロードキャスト** (Phase 1)
   - 月200通制限内で全友だちにpush
   - 今週の注目テーマ + note有料記事リンク

4. **有料鑑定** (Phase 1)
   - Stripe決済完了 → キューファイル作成
   - klawがheartbeatで拾い、星座×数秘術で個別生成
   - 結果をLINEリプライで送信

## 5. MVPで実装するもの

### Phase 0: 基盤（データ・設定・libモジュール）

既に完了:
- [x] `data/tarot-meanings.json` — 大アルカナ22枚
- [x] `data/ephemeris-2026.json` — 2026年365日分
- [x] `config/character.yaml` — カイのキャラ設定
- [x] `config/products.yaml` — Stripe商品定義
- [x] `config/schedule.yaml` — cron/サービス定義
- [x] `assets/tarot/` — タロット画像22枚
- [x] `data/templates/` — プロンプトテンプレート9種
- [x] `assets/profile-icon.jpg` — プロフィール画像

残タスク:
- [ ] `lib/zodiac.js` — 星座判定モジュール
- [ ] `lib/tarot.js` — タロットカード抽選モジュール
- [ ] `lib/ephemeris.js` — 天体暦参照モジュール
- [ ] 各libのテスト

### Phase 0.5: MVP（senta個人テスト）

- [ ] `scripts/fortune/batch-fortune.js` — 朝バッチ（klaw Gateway API経由で12星座分生成→JSON保存）
- [ ] `scripts/fortune/server.js` — LINE webhook（Express、リッチメニュータップ→星座別リプライ + 星座登録）
- [ ] `data/users.json` — ユーザー星座登録（sentaだけなのでJSONファイルで十分）
- [ ] LINE公式アカウント設定（リッチメニュー、Webhook URL）
- [ ] 手動テスト: バッチ実行→LINEで占い受信の一連フロー確認

### Phase 1: 公開（MVP検証後）

- Threads自動投稿
- note投稿
- ココナラ出品
- Stripe決済 + 有料鑑定
- 週間ブロードキャスト
- ファクトチェックエージェント

## 6. 技術仕様

### LINE Messaging API

| 操作 | 方式 | 通数 |
|------|------|------|
| 毎日の占い | リプライ（ユーザータップ起点） | 無料・無制限 |
| 週間push | ブロードキャスト（Phase 1） | 月200通（無料枠） |
| 有料鑑定結果 | リプライ（Phase 1） | 無料 |
| 星座登録 | リプライ | 無料 |

### 星座登録フロー

1. ユーザーが友だち追加 or 未登録状態でメッセージ送信
2. 「生年月日を教えてください（例: 1990/10/23）」とリプライ
3. 入力を `lib/zodiac.js` の `getZodiacSignFromBirthday(input)` でパース
   - 受付フォーマット: `YYYY/MM/DD`, `YYYY-MM-DD`, `YYYYMMDD`, `MM/DD`, `M月D日`
   - パース失敗時: 「正しい形式で入力してください（例: 1990/10/23）」とリプライ
4. 星座判定結果を `data/users.json` に保存: `{ "userId": { "sign": "aries", "registered_at": "..." } }`
5. 「登録しました。リッチメニューから今日の占いをどうぞ」とリプライ

### klaw Gateway API（batch-fortune.js → klaw）

```
POST http://localhost:18789/api/chat
Content-Type: application/json

{
  "message": "<line-daily.txt テンプレートに日付・天体暦・タロットカードを埋め込んだプロンプト>",
  "session": "isolated"
}
```

- `session: "isolated"` で毎回新セッション（前日の文脈を引きずらない）
- タイムアウト: 120秒（12星座分の一括生成は時間がかかる）
- レスポンス: `{ "response": "..." }` — klawの生成テキスト
- 失敗時: リトライ1回 → 失敗ならログ出力して終了（LINEリプライは前日分JSONで対応）

### UXフロー（MVP）

1. senta が LINE友だち追加
2. 自動挨拶メッセージ → 生年月日入力 → 星座登録（上記フロー参照）
3. リッチメニュー「今日の占い」タップ → 星座別テキスト即レス

### ファイル構造

```
lib/
  zodiac.js              星座判定
  tarot.js               タロット抽選
  ephemeris.js           天体暦参照
scripts/
  fortune/
    batch-fortune.js     朝バッチ（klaw呼び出し→JSON保存）
    server.js            LINE webhook（Express）
    line-broadcast.js    週間ブロードキャスト（Phase 1）
    post-threads.js      Threads投稿（Phase 1）
    post-note.js         note投稿（Phase 1）
    paid-reading.js      有料鑑定処理（Phase 1）
config/
  character.yaml         カイのキャラ設定
  products.yaml          Stripe商品（Phase 1）
  schedule.yaml          cron定義
data/
  tarot-meanings.json    タロット意味辞書
  ephemeris-2026.json    天体暦
  templates/             プロンプトテンプレート
  daily/                 日次占いJSON（batch-fortune.jsが自動生成）
  users.json             ユーザー星座登録（server.jsが自動生成）
assets/
  tarot/                 タロット画像
  profile-icon.jpg       プロフィール画像
tests/
  test_zodiac.js
  test_tarot.js
  test_ephemeris.js
```

### 日次占いJSONフォーマット

`data/daily/YYYY-MM-DD.json`:

```json
{
  "date": "2026-03-20",
  "generated_at": "2026-03-20T06:00:00+09:00",
  "fortunes": {
    "aries": {
      "sign": "牡羊座",
      "message": "今日は新しい出会いの予感...",
      "lucky_item": "白いハンカチ",
      "card": { "id": 0, "name": "愚者", "reversed": false }
    },
    "taurus": { "..." : "..." },
    "gemini": { "..." : "..." },
    "cancer": { "..." : "..." },
    "leo": { "..." : "..." },
    "virgo": { "..." : "..." },
    "libra": { "..." : "..." },
    "scorpio": { "..." : "..." },
    "sagittarius": { "..." : "..." },
    "capricorn": { "..." : "..." },
    "aquarius": { "..." : "..." },
    "pisces": { "..." : "..." }
  }
}
```

### ユーザーデータフォーマット

`data/users.json`:

```json
{
  "U1234567890abcdef": {
    "sign": "aries",
    "birthday": "1990-10-23",
    "registered_at": "2026-03-20T10:00:00+09:00"
  }
}
```

## 7. セキュリティ

- LINE Channel Secret / Access Token → `.env`
- klaw Gateway → localhost:18789（外部公開しない）
- Stripe API Key → `.env`（Phase 1）
- `eval()` 禁止
- ユーザー入力のサニタイズ（LINE webhook）
- LINE署名検証必須（`X-Line-Signature` ヘッダー）

## 8. 成功基準（MVP）

1. 朝バッチが12星座分の占いを自動生成し `data/daily/` にJSON保存できる
2. LINEでリッチメニュータップ→3秒以内に占いテキストが返る
3. 生年月日入力→星座登録→次回から星座別占いが返る
4. 3日連続でバッチ実行し、各日で異なるテキストが生成される
