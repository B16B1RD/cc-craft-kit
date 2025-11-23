---
description: "仕様書を削除します"
argument-hint: "<spec-id> [--yes] [--close-github-issue]"
---

# 仕様書削除

指定された仕様書をデータベースとファイルシステムから削除します。

## 引数

- `$1` (必須): 仕様書 ID（部分一致対応、最小 8 文字推奨）
- `--yes` または `-y` (オプション): 確認プロンプトをスキップ
- `--close-github-issue` (オプション): GitHub Issue を自動クローズ（デフォルトで有効）

## 実行内容

1. 仕様書 ID を検索（部分一致対応）
2. 削除対象の情報を表示（ID、名前、フェーズ、GitHub Issue 番号）
3. 確認プロンプト表示（`--yes` オプションでスキップ可能）
4. GitHub Issue を自動クローズ（GitHub 統合が有効な場合、デフォルトで実行）
5. データベースレコードを削除
6. 仕様書ファイル (`.cc-craft-kit/specs/<spec-id>.md`) を削除
7. `spec.deleted` イベントを発火

## 使用例

```bash
# 通常の削除（確認プロンプトあり、GitHub Issue は自動クローズ）
/cft:spec-delete 5e034974

# 確認プロンプトをスキップ（GitHub Issue は自動クローズ）
/cft:spec-delete 5e034974 --yes

# 明示的に GitHub Issue をクローズ（デフォルトと同じ動作）
/cft:spec-delete 5e034974 --close-github-issue --yes
```

## 注意事項

- **この操作は取り消せない**
- データベースレコードと仕様書ファイルの両方が削除される
- **GitHub Issue はデフォルトで自動的にクローズされる**（GitHub 統合が有効な場合）
- GitHub Issue クローズに失敗した場合、仕様書削除処理はスキップされる
- 削除前に必ずバックアップを確認すること

---

以下のコマンドを実行して仕様書を削除してください。

```bash
npx tsx .cc-craft-kit/commands/spec/delete.ts "$@"
```

削除が完了したら、結果を要約して表示してください。

## 削除後の処理

削除が完了したら、ユーザーに以下の情報を表示してください。

1. **削除された仕様書の情報**:
   - 仕様書 ID
   - 仕様書名
   - フェーズ

2. **GitHub Issue の状態**:
   - 関連する GitHub Issue 番号（存在する場合）
   - GitHub Issue が自動的にクローズされた旨の案内

3. **次のアクション**:
   - プロジェクト状態確認: `/cft:status`
   - データベース整合性チェック: `npx tsx .cc-craft-kit/scripts/repair-database.ts`
