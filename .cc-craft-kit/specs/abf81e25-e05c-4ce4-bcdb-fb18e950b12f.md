# 本開発キットを CLAUDE.md でコントロールしようとしている

**仕様書 ID:** abf81e25-e05c-4ce4-bcdb-fb18e950b12f
**フェーズ:** completed
**作成日時:** 2025/11/22 17:51:30
**更新日時:** 2025/11/22 18:35:15

---

## 1. 背景と目的

### 背景

ドッグフーディングでは CLAUDE.md でのコントロールは有効ですが、実際の運用では CLAUDE.md は活用できません。CLAUDE.md に依存しない開発キットとすべきです。

### 目的

現在、フェーズ自動処理は CLAUDE.md のスラッシュコマンド定義へ記載された指示へ依存しています。これにより、CLAUDE.md を持たないプロジェクトでは自動処理が機能しません。本仕様では、フェーズ自動処理を TypeScript コードとして実装し、CLAUDE.md へ依存しない独立した開発キットとして機能させることを目的とします。

---

## 2. 対象ユーザー

- cc-craft-kit を他のプロジェクトで利用する開発者
- CLAUDE.md を持たないプロジェクトで cc-craft-kit を使いたい開発者

---

## 3. 受け入れ基準

### 必須要件

- [ ] フェーズ自動処理が TypeScript コードで実装されている
- [ ] CLAUDE.md またはスラッシュコマンド定義に依存しない設計である
- [ ] 既存の自動処理（tasks、implementation フェーズ）が正常に動作する

### 機能要件

- [ ] tasks フェーズ移行時、受け入れ基準から実装タスクリストを自動生成する
- [ ] implementation フェーズ移行時、実装タスクリストを表示し、最初のタスクを開始する
- [ ] 品質チェック（typescript-eslint スキル）を自動実行する
- [ ] エラー発生時も適切なメッセージを表示し、フェーズ移行は継続する

### 非機能要件

- [ ] 既存のテストがすべて成功する
- [ ] 新しい自動処理に対応する単体テストが追加される
- [ ] コードカバレッジが 80% 以上を維持する

---

## 4. 制約条件

- 既存の仕様書フォーマットを変更しない
- 既存のイベント駆動アーキテクチャ（EventEmitter2）を継続使用する
- フェーズ移行時の Git 自動コミット機能は維持する
- 後方互換性を保つ（既存の仕様書、データベースレコードに影響しない）

---

## 5. 依存関係

### 既存コンポーネント

- `src/core/workflow/phase-automation.ts` - フェーズ自動処理ハンドラー（要修正）
- `src/core/workflow/event-bus.ts` - イベントバス（変更なし）
- `src/core/workflow/git-integration.ts` - Git 自動コミット（変更なし）
- `src/commands/spec/phase.ts` - フェーズ更新コマンド（変更なし）

### 新規コンポーネント

- タスクリスト生成モジュール（新規作成）
- 仕様書パーサーモジュール（受け入れ基準の解析）

---

## 6. 参考情報

- `src/core/workflow/phase-automation.ts` - 現行の実装
- `src/slash-commands/spec-phase.md` - スラッシュコマンド定義
- CLAUDE.md - プロジェクト指示ファイル（依存を削減する対象）

---

## 8. 実装タスクリスト

### Phase 1: 仕様書パーサーの実装

- [ ] 仕様書ファイルを読み込み、Markdown をパースするモジュールを作成する
  - ファイルパス: `src/core/spec/parser.ts`
  - 機能: 仕様書ファイルから受け入れ基準セクションを抽出
  - 機能: Markdown チェックボックス（`- [ ]`）を解析してタスクリストを生成
  - テスト: `tests/core/spec/parser.test.ts` を作成

### Phase 2: タスクリスト生成モジュールの実装

- [ ] 受け入れ基準からタスクリストを生成するモジュールを作成する
  - ファイルパス: `src/core/tasks/generator.ts`
  - 機能: 受け入れ基準をタスクに変換（必須要件、機能要件、非機能要件を分類）
  - 機能: タスクに優先度と依存関係を自動設定
  - 機能: Markdown 形式のタスクリストを生成
  - テスト: `tests/core/tasks/generator.test.ts` を作成

### Phase 3: 仕様書ファイル更新モジュールの実装

- [ ] 仕様書ファイルにタスクセクションを追加するモジュールを作成する
  - ファイルパス: `src/core/spec/updater.ts`
  - 機能: 仕様書ファイルの末尾に「## 8. 実装タスクリスト」セクションを追加
  - 機能: 既存セクションを上書きしない（セクション 7 の後に挿入）
  - 機能: fsync でディスクへ確実に書き込む
  - テスト: `tests/core/spec/updater.test.ts` を作成

### Phase 4: フェーズ自動処理ハンドラーの修正

- [ ] `src/core/workflow/phase-automation.ts` の tasks フェーズ処理を実装する
  - 仕様書パーサーで受け入れ基準を取得
  - タスクリスト生成モジュールでタスクリストを作成
  - 仕様書ファイル更新モジュールでセクションを追加
  - `/cft:spec-update` コマンドを自動実行（execSync）
  - エラー時もフェーズ移行を継続する

- [ ] `src/core/workflow/phase-automation.ts` の implementation フェーズ処理を実装する
  - 仕様書パーサーでタスクリストセクションを取得
  - タスクを標準出力に表示（YAML 形式または表形式）
  - 最初の未完了タスクを強調表示
  - エラー時もフェーズ移行を継続する

### Phase 5: CLAUDE.md 依存の削減

- [ ] `src/core/workflow/phase-automation.ts` から「CLAUDE.md の指示通り」メッセージを削除する
  - 各フェーズの console.log メッセージを更新
  - 自動処理の内容を明示的に記載(例:「タスクリストを生成しています...」)

- [ ] `src/slash-commands/spec-phase.md` のフェーズ移行後の自動処理セクションを削除する
  - スラッシュコマンド定義は単なるコマンド実行指示のみに簡素化
  - 自動処理の詳細は TypeScript コードに移動済みであることを明記

### Phase 6: テストとドキュメント整備

- [ ] 新規作成した全モジュールの単体テストを実装する
  - `tests/core/spec/parser.test.ts`
  - `tests/core/tasks/generator.test.ts`
  - `tests/core/spec/updater.test.ts`
  - `tests/core/workflow/phase-automation.test.ts` を拡張

- [ ] E2E テストを実装する
  - `tests/e2e/phase-automation.test.ts` を作成
  - tasks フェーズ移行 → タスクリスト自動生成を検証
  - implementation フェーズ移行 → タスクリスト表示を検証

- [ ] CLAUDE.md を更新する
  - 「フェーズ自動処理は TypeScript コードで実装されています」と明記
  - スラッシュコマンド定義への依存が削減されたことを記載
