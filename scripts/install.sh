#!/bin/sh
set -e

# ========================================
# cc-craft-kit インストールスクリプト
# ========================================
# このスクリプトは、Git 操作なしで cc-craft-kit を任意のプロジェクトにインストールします。
#
# 使用方法:
#   curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- /path/to/project
#   curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- --project my-app
#
# ========================================

# ========================================
# グローバル変数
# ========================================
TAKUMI_REPO="B16B1RD/cc-craft-kit"
TAKUMI_BASE_URL="https://github.com/${TAKUMI_REPO}"
TAKUMI_RELEASES_API="https://api.github.com/repos/${TAKUMI_REPO}/releases/latest"
INSTALL_DIR="."
VERSION="latest"
LOG_FILE=".cc-craft-kit/install.log"

# 色付きメッセージ用のANSIエスケープコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ========================================
# ユーティリティ関数
# ========================================

# エラーメッセージを表示して終了
error() {
  printf "${RED}エラー: %s${NC}\n" "$1" >&2
  exit 1
}

# 警告メッセージを表示
warn() {
  printf "${YELLOW}警告: %s${NC}\n" "$1" >&2
}

# 情報メッセージを表示（stderr に出力）
info() {
  printf "${BLUE}%s${NC}\n" "$1" >&2
}

# 成功メッセージを表示（stderr に出力）
success() {
  printf "${GREEN}✓ %s${NC}\n" "$1" >&2
}

# ========================================
# セキュリティ検証関数
# ========================================

# パス検証
validate_path() {
  case "$1" in
    *[\;\&\|\$\`\(\)\<\>\'\"]*)
      error "無効なパス名です。特殊文字は使用できません。"
      ;;
  esac
}

# バージョン形式検証
validate_version() {
  if ! echo "$1" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
    error "無効なバージョン形式です: $1"
  fi
}

# アーカイブ整合性チェック
verify_archive() {
  local archive_file=$1

  # ファイルサイズチェック
  local file_size=$(stat -f%z "$archive_file" 2>/dev/null || stat -c%s "$archive_file" 2>/dev/null)
  if [ "$file_size" -lt 1024 ]; then
    error "ダウンロードしたファイルが小さすぎます（${file_size} bytes）"
  fi

  # tar整合性チェック
  if ! tar -tzf "$archive_file" >/dev/null 2>&1; then
    error "アーカイブファイルが破損しています。"
  fi

  # .cc-craft-kit/ ディレクトリの存在確認
  if ! tar -tzf "$archive_file" | grep -q '^\.cc-craft-kit/'; then
    error "無効なアーカイブです。.cc-craft-kit/ ディレクトリが見つかりません。"
  fi
}

# ========================================
# 環境チェック関数
# ========================================

check_prerequisites() {
  info "環境をチェックしています..."

  # Node.js チェック
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js がインストールされていません。\nNode.js 18 以降をインストールしてください: https://nodejs.org/"
  fi

  # Node.js バージョンチェック
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18 以降が必要です（現在: $(node -v)）\nNode.js をアップデートしてください: https://nodejs.org/"
  fi

  # npm チェック
  if ! command -v npm >/dev/null 2>&1; then
    error "npm がインストールされていません。\nNode.js と一緒にインストールしてください: https://nodejs.org/"
  fi

  # curl チェック
  if ! command -v curl >/dev/null 2>&1; then
    error "curl がインストールされていません。\nパッケージマネージャーでインストールしてください（例: apt install curl）"
  fi

  # tar チェック
  if ! command -v tar >/dev/null 2>&1; then
    error "tar がインストールされていません。\nパッケージマネージャーでインストールしてください（例: apt install tar）"
  fi

  success "環境チェック完了"
}

# ========================================
# OS検出関数
# ========================================

detect_os() {
  case "$(uname -s)" in
    Linux*)   echo "linux" ;;
    Darwin*)  echo "macos" ;;
    CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

# ========================================
# 最新バージョン取得関数
# ========================================

fetch_latest_version() {
  info "GitHub Releases から最新バージョンを取得しています..."

  # GitHub Releases API にリクエスト
  VERSION_DATA=$(curl -fsSL "$TAKUMI_RELEASES_API") || {
    error "GitHub Releases API への接続に失敗しました。ネットワーク接続を確認してください。"
  }

  # JSON形式の妥当性チェック
  if ! echo "$VERSION_DATA" | grep -q '^{'; then
    error "GitHub API レスポンスが無効です。"
  fi

  # tag_name を抽出
  LATEST_VERSION=$(echo "$VERSION_DATA" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)

  # browser_download_url を抽出
  DOWNLOAD_URL=$(echo "$VERSION_DATA" | grep -o '"browser_download_url": *"[^"]*\.cc-craft-kit\.tar\.gz"' | head -1 | cut -d'"' -f4)

  if [ -z "$LATEST_VERSION" ] || [ -z "$DOWNLOAD_URL" ]; then
    error "最新バージョンの取得に失敗しました。リポジトリに GitHub Release が存在することを確認してください。"
  fi

  # バージョン形式検証
  validate_version "$LATEST_VERSION"

  success "最新バージョン: $LATEST_VERSION"
}

# ========================================
# アーカイブダウンロード関数
# ========================================

download_archive() {
  info "cc-craft-kit $LATEST_VERSION をダウンロードしています..."

  # 一時ファイル作成
  TEMP_FILE=$(mktemp) || {
    error "一時ファイルの作成に失敗しました。"
  }

  # ダウンロード
  if ! curl -fsSL -o "$TEMP_FILE" "$DOWNLOAD_URL"; then
    rm -f "$TEMP_FILE"
    error "アーカイブのダウンロードに失敗しました。URL: $DOWNLOAD_URL ネットワーク接続を確認してください。"
  fi

  # アーカイブ検証
  verify_archive "$TEMP_FILE"

  success "ダウンロード完了"
  echo "$TEMP_FILE"
}

# ========================================
# アーカイブ展開関数
# ========================================

extract_archive() {
  ARCHIVE_FILE=$1
  info "アーカイブを $INSTALL_DIR に展開しています..."

  # 既存の .cc-craft-kit/ ディレクトリチェック
  if [ -d "$INSTALL_DIR/.cc-craft-kit" ]; then
    warn ".cc-craft-kit/ ディレクトリがすでに存在します。"
    printf "上書きしますか？ [y/N]: "
    read -r REPLY
    if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
      info "インストールをキャンセルしました。"
      rm -f "$ARCHIVE_FILE"
      exit 0
    fi
    rm -rf "$INSTALL_DIR/.cc-craft-kit"
  fi

  # 展開
  if ! tar -xzf "$ARCHIVE_FILE" -C "$INSTALL_DIR"; then
    rm -f "$ARCHIVE_FILE"
    error "アーカイブの展開に失敗しました。"
  fi

  # 一時ファイル削除
  rm -f "$ARCHIVE_FILE"

  success "展開完了"
}

# ========================================
# シンボリックリンク作成関数
# ========================================

create_symlink() {
  info "シンボリックリンクを作成しています..."

  # .claude/commands/ ディレクトリ作成
  mkdir -p "$INSTALL_DIR/.claude/commands"

  # 既存のシンボリックリンクを削除
  if [ -L "$INSTALL_DIR/.claude/commands/cft" ] || [ -d "$INSTALL_DIR/.claude/commands/cft" ]; then
    rm -rf "$INSTALL_DIR/.claude/commands/cft"
  fi

  # OS 別のシンボリックリンク作成
  OS=$(detect_os)
  if [ "$OS" = "windows" ]; then
    # Windows: cmd //c mklink を試行
    cmd //c mklink //D "$INSTALL_DIR\\.claude\\commands\\cft" "$INSTALL_DIR\\.cc-craft-kit\\commands" 2>/dev/null || \
    ln -s "$INSTALL_DIR/.cc-craft-kit/commands" "$INSTALL_DIR/.claude/commands/cft" 2>/dev/null || {
      warn "シンボリックリンクの作成に失敗しました。"
      echo "  手動で作成してください:" >&2
      echo "    ln -s $INSTALL_DIR/.cc-craft-kit/commands $INSTALL_DIR/.claude/commands/cft" >&2
      return
    }
  else
    # Linux/macOS: 相対パスでシンボリックリンク作成
    cd "$INSTALL_DIR/.claude/commands"
    ln -s "../../.cc-craft-kit/commands" cft || {
      warn "シンボリックリンクの作成に失敗しました。"
      echo "  手動で作成してください:" >&2
      echo "    ln -s ../../.cc-craft-kit/commands $INSTALL_DIR/.claude/commands/cft" >&2
      cd - >/dev/null
      return
    }
    cd - >/dev/null
  fi

  success "シンボリックリンク作成完了"
}

# ========================================
# .env 生成関数
# ========================================

generate_env() {
  if [ -f "$INSTALL_DIR/.env" ]; then
    info ".env ファイルがすでに存在します（上書きせず保持します）"
    return
  fi

  if [ -f "$INSTALL_DIR/.cc-craft-kit/.env.example" ]; then
    info ".env ファイルを生成しています..."
    cp "$INSTALL_DIR/.cc-craft-kit/.env.example" "$INSTALL_DIR/.env"
    success ".env ファイル生成完了"
  else
    warn ".env.example が見つかりません。.env ファイルを手動で作成してください。"
  fi
}

# ========================================
# プロジェクト初期化関数
# ========================================

init_project() {
  info "cc-craft-kit プロジェクトを初期化しています..."

  cd "$INSTALL_DIR"
  if npx tsx .cc-craft-kit/commands/init.ts "My Project" "cc-craft-kit project" >/dev/null 2>&1; then
    success "プロジェクト初期化完了"
  else
    warn "プロジェクトの初期化に失敗しました。\n手動で実行してください: /cft:init"
  fi
}

# ========================================
# 成功メッセージ表示関数
# ========================================

show_success() {
  echo ""
  success "cc-craft-kit のインストールが完了しました！"
  echo ""
  echo "次のステップ:"
  echo "  1. .env ファイルを編集して GitHub トークンを設定"
  echo "  2. 実行: /cft:status"
  echo "  3. 仕様書を作成: /cft:spec-create \"機能名\""
  echo ""
  echo "詳細なドキュメント: $TAKUMI_BASE_URL"
  echo ""
}

# ========================================
# ヘルプメッセージ表示関数
# ========================================

show_help() {
  cat << EOF
cc-craft-kit インストールスクリプト

使用方法:
  curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh
  curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- [オプション]

オプション:
  (引数なし)              カレントディレクトリにインストール
  /path/to/project        指定したディレクトリにインストール
  --project <name>        新規ディレクトリを作成してインストール
  --version <version>     特定バージョンをインストール（デフォルト: 最新版）
  --help                  このヘルプメッセージを表示

例:
  # カレントディレクトリにインストール
  curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh

  # 指定したディレクトリにインストール
  curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- /path/to/my-project

  # 新規ディレクトリを作成してインストール
  curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- --project my-new-project

  # 特定バージョンをインストール
  curl -fsSL https://raw.githubusercontent.com/B16B1RD/cc-craft-kit/main/scripts/install.sh | sh -s -- --version v1.0.0

詳細: $TAKUMI_BASE_URL
EOF
}

# ========================================
# メイン処理
# ========================================

main() {
  # 引数解析
  while [ $# -gt 0 ]; do
    case "$1" in
      --project)
        INSTALL_DIR="$2"
        validate_path "$INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
        shift 2
        ;;
      --version)
        VERSION="$2"
        validate_version "$VERSION"
        shift 2
        ;;
      --help)
        show_help
        exit 0
        ;;
      *)
        INSTALL_DIR="$1"
        validate_path "$INSTALL_DIR"
        shift
        ;;
    esac
  done

  # インストール開始
  info "cc-craft-kit のインストールを開始します..."
  echo ""

  check_prerequisites
  fetch_latest_version
  ARCHIVE_FILE=$(download_archive)
  extract_archive "$ARCHIVE_FILE"
  create_symlink
  generate_env
  init_project
  show_success
}

main "$@"
