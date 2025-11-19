# ブランチ保護ルール設定手順書

このドキュメントは、cc-craft-kit プロジェクトの GitHub リポジトリにおけるブランチ保護ルールの設定手順を説明します。

## 目次

- [概要](#概要)
- [前提条件](#前提条件)
- [main ブランチの保護設定](#main-ブランチの保護設定)
- [develop ブランチの保護設定](#develop-ブランチの保護設定)
- [設定確認方法](#設定確認方法)
- [トラブルシューティング](#トラブルシューティング)

## 概要

cc-craft-kit は **GitHub Flow + develop ブランチ** 戦略を採用しています。この戦略では、以下の 2 つのメインブランチに対してブランチ保護ルールを設定する必要があります。

- **main**: 本番リリース済みの安定版コード
- **develop**: 次期リリース候補の統合ブランチ

## 前提条件

- GitHub リポジトリの管理者権限を持っていること
- リポジトリに `main` と `develop` ブランチが存在すること

## main ブランチの保護設定

### 手順

1. GitHub リポジトリページにアクセス
2. **Settings** タブをクリック
3. 左サイドバーの **Branches** をクリック
4. **Branch protection rules** セクションで **Add branch protection rule** をクリック
5. 以下のように設定する

#### Branch name pattern

```text
main
```

#### Protect matching branches

以下のチェックボックスをすべて有効にします。

##### Require a pull request before merging

- ✅ **Require a pull request before merging**
  - ✅ **Require approvals**: `1` 名以上
  - ✅ **Dismiss stale pull request approvals when new commits are pushed**
  - ⬜ **Require review from Code Owners** (オプション: CODEOWNERS ファイルがある場合)

##### Require status checks to pass before merging

- ✅ **Require status checks to pass before merging**
  - ✅ **Require branches to be up to date before merging**
  - 以下のステータスチェックを追加:
    - `lint` (CI ワークフロー)
    - `typecheck` (CI ワークフロー)
    - `docs` (CI ワークフロー)
    - `test (18)` (CI ワークフロー - Node.js 18)
    - `test (20)` (CI ワークフロー - Node.js 20)
    - `security` (CI ワークフロー)

##### その他の設定

- ✅ **Require conversation resolution before merging**
- ✅ **Include administrators** (管理者も含めてルール適用)
- ⬜ **Allow force pushes** (無効のまま)
- ⬜ **Allow deletions** (無効のまま)

### 設定後の動作

- `main` ブランチへの直接 push が禁止される
- すべての変更は PR 経由でマージする必要がある
- PR マージには 1 名以上のレビュー承認が必要
- CI テストがすべて通過している必要がある
- マージ前にブランチを最新化する必要がある

## develop ブランチの保護設定

### 手順

1. GitHub リポジトリページにアクセス
2. **Settings** タブをクリック
3. 左サイドバーの **Branches** をクリック
4. **Branch protection rules** セクションで **Add branch protection rule** をクリック
5. 以下のように設定する

#### Branch name pattern

```text
develop
```

#### Protect matching branches

以下のチェックボックスを有効にします。

##### Require a pull request before merging

- ✅ **Require a pull request before merging**
  - ⬜ **Require approvals**: 1 人開発の場合は不要（複数人開発の場合は `1` 名以上推奨）
  - ⬜ **Dismiss stale pull request approvals when new commits are pushed** (1 人開発の場合は不要)

##### Require status checks to pass before merging

- ✅ **Require status checks to pass before merging**
  - ✅ **Require branches to be up to date before merging**
  - 以下のステータスチェックを追加:
    - `lint` (CI ワークフロー)
    - `typecheck` (CI ワークフロー)
    - `docs` (CI ワークフロー)
    - `test (18)` (CI ワークフロー - Node.js 18)
    - `test (20)` (CI ワークフロー - Node.js 20)
    - `security` (CI ワークフロー)

##### その他の設定

- ✅ **Require conversation resolution before merging**
- ⬜ **Include administrators** (1 人開発の場合は不要、複数人開発の場合は有効推奨)
- ⬜ **Allow force pushes** (無効のまま)
- ⬜ **Allow deletions** (無効のまま)

### 設定後の動作

- `develop` ブランチへの直接 push が禁止される
- すべての変更は PR 経由でマージする必要がある
- CI テストがすべて通過している必要がある
- マージ前にブランチを最新化する必要がある

## 設定確認方法

### CLI で確認

GitHub CLI (`gh`) を使用して設定を確認できます。

```bash
# main ブランチの保護ルールを確認
gh api repos/:owner/:repo/branches/main/protection

# develop ブランチの保護ルールを確認
gh api repos/:owner/:repo/branches/develop/protection
```

### Web UI で確認

1. GitHub リポジトリページにアクセス
2. **Settings** > **Branches** をクリック
3. **Branch protection rules** セクションで各ブランチのルールを確認

## トラブルシューティング

### 問題: 管理者権限がない場合

**原因**: ブランチ保護ルールの設定にはリポジトリの管理者権限が必要。

**解決策**:

1. リポジトリオーナーに権限昇格を依頼
2. または、既存の管理者にブランチ保護設定を依頼

### 問題: CI ステータスチェックが表示されない

**原因**: CI ワークフローが一度も実行されていない。

**解決策**:

1. 対象ブランチで PR を作成し、CI を実行
2. CI が完了したら、ブランチ保護設定画面で **Require status checks to pass before merging** を有効化
3. 検索ボックスにステータスチェック名（`lint`, `typecheck` など）を入力して追加

### 問題: 管理者でもマージできない

**原因**: **Include administrators** が有効になっている。

**解決策**:

- 開発初期段階では **Include administrators** を無効にして柔軟に対応
- チームが拡大したら再度有効化を検討

### 問題: ブランチ保護ルールを設定したが、直接 push できてしまう

**原因**: ブランチ名パターンが正しく設定されていない。

**解決策**:

1. **Settings** > **Branches** で設定を再確認
2. Branch name pattern が `main` または `develop` と完全一致しているか確認
3. ワイルドカード（`*`）が含まれていないか確認

### 問題: 緊急時にマージが必要

**症状**: 重大なバグ修正で即座にマージが必要だが、PR レビューを待てない。

**解決策**:

1. Settings → Branches → 該当ブランチの Edit ボタンをクリック
2. 一時的に **Require a pull request before merging** を無効化
3. マージ完了後、即座に再有効化
4. チームに報告（Slack 等）

**注意**: 緊急時のみ使用し、必ず元に戻すこと。

## 参考リンク

- [GitHub Docs: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Docs: Managing a branch protection rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
