# 仕様書ファイルとデータベース間の同期修復

仕様書ファイル (`.cc-craft-kit/specs/*.md`) とデータベース (`specs` テーブル) 間の整合性を自動修復します。

## 実行内容

1. IntegrityChecker.check() で差分を検出
2. filesOnly → SyncService.importFromFiles() でデータベースにインポート
3. dbOnly → 警告表示 (ファイル削除済みの可能性)
4. mismatch → ファイル優先で上書き更新
5. 修復完了レポートを出力

## 修復ルール

- **ファイルのみ存在**: データベースにインポート (新規挿入)
- **DBのみ存在**: 警告のみ表示 (手動での確認を推奨)
- **メタデータ不一致**: ファイルのデータを優先してデータベースを更新

## 使用例

```bash
/cft:sync-repair
```

## 出力内容

- **Imported**: 新規にインポートされた仕様書数
- **Updated**: メタデータが更新された仕様書数
- **Skipped**: スキップされた仕様書数
- **Failed**: インポート/更新に失敗した仕様書数
- **Sync Rate**: 修復後の同期率 (%)

---

以下のコマンドを実行して同期を修復してください。

```bash
npx tsx .cc-craft-kit/commands/sync/repair.ts
```

修復完了後、以下のコマンドで整合性を再確認できます。

```bash
/cft:sync-check
```
