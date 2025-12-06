#!/bin/bash
# 仕様書を YAML フロントマター形式に移行するスクリプト
# 使用方法: ./scripts/migrate-specs-to-yaml-frontmatter.sh

set -e

SPECS_DIR=".cc-craft-kit/specs"
DB_PATH=".cc-craft-kit/cc-craft-kit.db"
BACKUP_DIR=".cc-craft-kit/specs-backup-$(date +%Y%m%d-%H%M%S)"

# バックアップ作成
echo "📦 仕様書をバックアップ中..."
mkdir -p "$BACKUP_DIR"
cp -r "$SPECS_DIR"/*.md "$BACKUP_DIR/" 2>/dev/null || true
echo "   → バックアップ: $BACKUP_DIR"

# 移行カウンター
TOTAL=0
MIGRATED=0
SKIPPED=0

# DB から全仕様書情報を取得
echo ""
echo "🔍 データベースから仕様書情報を取得中..."

# 一時ファイルに出力
sqlite3 -separator '|' "$DB_PATH" "
SELECT
  s.id,
  s.name,
  s.phase,
  s.branch_name,
  s.created_at,
  s.updated_at,
  COALESCE(g.issue_number, ''),
  COALESCE(g.pr_url, '')
FROM specs s
LEFT JOIN github_sync g ON s.id = g.entity_id AND g.entity_type = 'spec'
" > /tmp/specs_data.txt

echo ""
echo "📝 仕様書を YAML フロントマター形式に変換中..."

while IFS='|' read -r id name phase branch_name created_at updated_at issue_number pr_url; do
  TOTAL=$((TOTAL + 1))
  SPEC_FILE="$SPECS_DIR/$id.md"

  if [ ! -f "$SPEC_FILE" ]; then
    echo "   ⚠️ ファイルなし: $id"
    continue
  fi

  # 既に YAML フロントマターがあるかチェック
  if head -1 "$SPEC_FILE" | grep -q "^---$"; then
    # 2行目も確認（YAML の可能性）
    if head -3 "$SPEC_FILE" | tail -1 | grep -qE "^(id:|name:)"; then
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  # 現在のファイル内容を取得（先頭のメタデータ部分をスキップ）
  # パターン: # タイトル + **仕様書 ID:** + **フェーズ:** + **作成日時:** + **更新日時:** + ---

  # 現在の内容をすべて保持
  CURRENT_CONTENT=$(cat "$SPEC_FILE")

  # タイトル行を抽出（# で始まる最初の行）
  TITLE=$(echo "$CURRENT_CONTENT" | grep -m1 "^# " | sed 's/^# //')

  # タイムスタンプを ISO8601 形式に変換
  # 入力形式: 2025/11/17 10:19:19 または 2025-11-17T10:19:19...
  format_timestamp() {
    local ts="$1"
    if [[ "$ts" == *"/"* ]]; then
      # 2025/11/17 10:19:19 形式
      echo "$ts" | sed 's|/|-|g' | sed 's/ /T/' | sed 's/$/.000Z/'
    elif [[ "$ts" == *"T"* ]]; then
      # 既に ISO8601 形式
      echo "$ts"
    else
      echo "$ts"
    fi
  }

  CREATED_ISO=$(format_timestamp "$created_at")
  UPDATED_ISO=$(format_timestamp "$updated_at")

  # YAML フロントマターを生成
  YAML_FRONTMATTER="---
id: \"$id\"
name: \"$name\"
phase: \"$phase\"
branch_name: \"$branch_name\""

  if [ -n "$issue_number" ]; then
    YAML_FRONTMATTER="$YAML_FRONTMATTER
github_issue_number: $issue_number"
  else
    YAML_FRONTMATTER="$YAML_FRONTMATTER
github_issue_number: null"
  fi

  if [ -n "$pr_url" ]; then
    YAML_FRONTMATTER="$YAML_FRONTMATTER
pr_url: \"$pr_url\""
  else
    YAML_FRONTMATTER="$YAML_FRONTMATTER
pr_url: null"
  fi

  YAML_FRONTMATTER="$YAML_FRONTMATTER
created_at: \"$CREATED_ISO\"
updated_at: \"$UPDATED_ISO\"
---"

  # 旧フォーマットのメタデータ行を削除した本文を取得
  # パターン:
  # # タイトル
  # 空行
  # **仕様書 ID:**...
  # **フェーズ:**...
  # **作成日時:**...
  # **更新日時:**...
  # 空行
  # ---
  BODY=$(echo "$CURRENT_CONTENT" | sed '
    # 最初の # タイトル行を削除
    1{/^# /d}
    # **仕様書 ID:** 行を削除
    /^\*\*仕様書 ID:\*\*/d
    # **フェーズ:** 行を削除
    /^\*\*フェーズ:\*\*/d
    # **作成日時:** 行を削除
    /^\*\*作成日時:\*\*/d
    # **更新日時:** 行を削除
    /^\*\*更新日時:\*\*/d
    # 先頭の空行を削除（最初の --- までの空行）
  ' | sed '/^$/N;/^\n---$/s/^\n//')

  # 先頭の空行と最初の --- 区切りを削除
  BODY=$(echo "$BODY" | sed '1{/^$/d}' | sed '1{/^---$/d}' | sed '1{/^$/d}')

  # タイトル行を再追加（本文の先頭に）
  if [ -n "$TITLE" ]; then
    NEW_CONTENT="$YAML_FRONTMATTER

# $TITLE
$BODY"
  else
    NEW_CONTENT="$YAML_FRONTMATTER
$BODY"
  fi

  # ファイルを更新
  echo "$NEW_CONTENT" > "$SPEC_FILE"
  MIGRATED=$((MIGRATED + 1))

  # 進捗表示（10件ごと）
  if [ $((MIGRATED % 10)) -eq 0 ]; then
    echo "   → $MIGRATED 件変換済み..."
  fi

done < /tmp/specs_data.txt

rm -f /tmp/specs_data.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 移行完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "| 項目 | 件数 |"
echo "|------|-----:|"
echo "| 総数 | $TOTAL |"
echo "| 変換済み | $MIGRATED |"
echo "| スキップ | $SKIPPED |"
echo ""
echo "バックアップ: $BACKUP_DIR"
echo ""
echo "次のステップ:"
echo "  git diff .cc-craft-kit/specs/  # 変更を確認"
echo "  git add .cc-craft-kit/specs/   # 変更をステージ"
