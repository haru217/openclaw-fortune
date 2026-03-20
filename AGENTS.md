# openclaw-fortune — Project Rules

## Overview

占い自動マネタイズシステム。LINE公式アカウントを中核に、Threads/note/ココナラで集客し、Stripe決済で課金する。

## Required Workflow (Superpowers-based)

すべてのコード実装はこのワークフローに従うこと:

### 1. TDD (Test-Driven Development)

**必須スキル**: `codex-tdd-workflow`

- テストを先に書く → 失敗を確認 → 最小実装 → テストパス → リファクタ
- テストは `tests/` ディレクトリに配置
- テストランナー: `node --test tests/`
- テストファイル名: `test_{module}.js` (例: `test_zodiac.js`)

### 2. Verification Before Completion

**必須スキル**: `verification-before-completion`

- 「完了」と報告する前に必ず検証コマンドを実行し、その出力を証拠として提示
- "should work" "probably fine" は禁止。証拠のみ。
- テスト → ビルド → 仕様照合の順で検証

### 3. Systematic Debugging

**必須スキル**: `systematic-debugging`

- バグやテスト失敗に遭遇したら、推測修正する前に再現→分離→仮説→検証の手順を踏む

## Architecture

```
lib/          → 純粋なモジュール（外部依存なし、テスト容易）
scripts/      → 実行スクリプト（lib/ を組み合わせて使う）
config/       → YAML設定ファイル（キャラ設定、商品、スケジュール）
data/         → JSON データファイル（タロット意味辞書、天体暦）
tests/        → テスト
assets/       → 静的ファイル（タロット画像）
```

## Coding Style (JavaScript/Node.js)

- Node.js >= 20（built-in test runner 使用）
- `async/await` を使う（`.then()` チェーン禁止）
- Vanilla JS（TypeScript不要、フレームワーク不要）
- `require()` (CommonJS) を使用
- 関数は1つのことだけ行う
- エラーは明示的にハンドリング（silent fail禁止）

## Data Files (既に作成済み)

| ファイル | 内容 |
|---------|------|
| `data/tarot-meanings.json` | 大アルカナ22枚の意味辞書 |
| `data/ephemeris-2026.json` | 2026年365日分の天体暦 |
| `config/character.yaml` | カイのキャラクター設定 |
| `config/products.yaml` | Stripe商品定義 |
| `config/schedule.yaml` | cron/サービス定義 |

## Phase 0 残タスク: lib モジュール実装

### lib/zodiac.js
- `getZodiacSign(dateString)` → 星座オブジェクトを返す
- `getZodiacSignFromBirthday(birthdayString)` → 生年月日から星座判定
- `ZODIAC_SIGNS` 定数をエクスポート
- 仕様: spec-v2 セクション 8.1

### lib/tarot.js
- `drawCards(count, allowReversed)` → カードをランダムに引く
- `getCardMeaning(cardId)` → data/tarot-meanings.json から意味を取得
- `MAJOR_ARCANA` 定数をエクスポート
- 仕様: spec-v2 セクション 8.2

### lib/ephemeris.js
- `getEphemeris(dateString)` → その日の天体データを返す
- `getMoonPhase(dateString)` → 月相を返す
- data/ephemeris-2026.json を読み込んで使う
- 仕様: spec-v2 セクション 8.3

### テスト要件
各モジュールに対して:
- 正常系テスト（代表的な入力で正しい出力）
- 境界値テスト（星座の切り替わり日、年末年始）
- エッジケース（無効な入力、存在しない日付）

## Security

- APIキー・トークンはハードコードしない（`.env` + `process.env`）
- `.env` は `.gitignore` に含まれている
- `eval()` 禁止
- SQL パラメータバインド必須（Phase 1以降）

## Git

- コミットはユーザーが明示的に依頼したときのみ
- `git add -A` 禁止、ファイル個別指定
- コミット後は `git push origin main`
