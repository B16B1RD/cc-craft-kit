---
description: 仕様書ファイルの変更を監視してGitHub Issueに自動通知
---

# 仕様書ファイル監視

仕様書ファイル（`.cc-craft-kit/specs/*.md`）の変更を監視し、変更があった場合に自動的に GitHub Issue に更新通知を送信します。

## 引数

なし

## 実行内容

1. `.cc-craft-kit/specs/` ディレクトリの監視を開始
2. `.md` ファイルの変更を検知（デバウンス処理あり）
3. 変更検知時に `spec.updated` イベントを発火
4. GitHub Issue に更新通知コメントを自動追加
5. Ctrl+C で監視を停止

## 使用例

```bash
/cc-craft-kit:watch
```

## 詳細

- **デバウンス時間**: 500ms（連続した変更を 1 回にまとめる）
- **監視対象**: `.cc-craft-kit/specs/*.md` ファイルのみ
- **ログレベル**: `--log-level=debug` で詳細ログを表示可能

---

以下のコマンドを実行して仕様書ファイルの監視を開始してください。

```bash
npx tsx .cc-craft-kit/commands/watch.ts
```

監視が開始されると、仕様書ファイルを編集するたびに自動的に GitHub Issue に更新通知が送信されます。

**注意**: このコマンドはバックグラウンドプロセスとして動作し続けます。停止する場合は Ctrl+C を押してください。
