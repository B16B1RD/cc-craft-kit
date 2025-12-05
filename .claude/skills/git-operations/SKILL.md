---
name: git-operations
description: Provides Git command helpers for branch management, commit history analysis, and repository operations. Use this skill when you need to interact with Git repositories, analyze commit history, or manage branches.
---

# Git Operations Skill

This skill provides comprehensive Git repository management and analysis capabilities.

## Capabilities

### Repository Information

- Check repository status
- View current branch
- List all branches (local and remote)
- Show remote repository URLs
- Get repository root path

### Branch Management

- Create new branches
- Switch between branches
- Delete branches
- Rename branches
- Track remote branches
- List merged/unmerged branches

### Commit History Analysis

- View commit logs
- Search commits by message, author, or date
- Show commit diffs
- Find commits that changed specific files
- Analyze commit frequency and patterns
- Generate changelog from commits

### File Operations

- Stage files
- Unstage files
- Discard changes
- Show file history
- Blame/annotate files
- Track file renames

## Usage Examples

### Check Repository Status

```bash
# Full status
git status

# Short status
git status -s

# Show untracked files
git status -u
```

### Branch Operations

```bash
# List all branches
git branch -a

# Create new branch
git branch feature/new-feature

# Switch to branch
git checkout feature/new-feature

# Create and switch in one command
git checkout -b feature/new-feature

# Delete local branch
git branch -d feature/old-feature

# Force delete unmerged branch
git branch -D feature/old-feature

# Delete remote branch
git push origin --delete feature/old-feature

# Rename current branch
git branch -m new-branch-name

# Show branches merged to current
git branch --merged

# Show branches not merged
git branch --no-merged
```

### Commit History

```bash
# View recent commits
git log -10

# One-line format
git log --oneline -10

# With file changes
git log --stat -10

# Search by message
git log --grep="fix bug"

# Search by author
git log --author="John Doe"

# Search by date range
git log --since="2024-01-01" --until="2024-12-31"

# Show commits affecting a file
git log -- path/to/file.ts

# Graph view
git log --graph --oneline --all

# Show specific commit
git show abc123f
```

### File History and Blame

```bash
# Show who changed each line
git blame path/to/file.ts

# Show file history
git log -p -- path/to/file.ts

# Find when a file was deleted
git log --all --full-history -- path/to/deleted/file.ts

# Track file renames
git log --follow -- path/to/file.ts
```

### Diff Operations

```bash
# Show unstaged changes
git diff

# Show staged changes
git diff --staged

# Compare branches
git diff main..feature/branch

# Compare with specific commit
git diff abc123f

# Show diff for specific file
git diff -- path/to/file.ts

# Word-level diff
git diff --word-diff
```

### Stash Operations

```bash
# Stash changes
git stash

# Stash with message
git stash save "WIP: feature implementation"

# List stashes
git stash list

# Apply latest stash
git stash apply

# Apply and remove stash
git stash pop

# Apply specific stash
git stash apply stash@{2}

# Drop stash
git stash drop stash@{0}

# Show stash contents
git stash show -p stash@{0}
```

### Remote Operations

```bash
# Show remotes
git remote -v

# Add remote
git remote add origin https://github.com/user/repo.git

# Fetch from remote
git fetch origin

# Pull changes
git pull origin main

# Push changes
git push origin feature/branch

# Push and set upstream
git push -u origin feature/branch

# Force push (use with caution)
git push --force-with-lease origin feature/branch
```

## Common Workflows

### Feature Branch Workflow

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: implement new feature"

# 3. Push to remote
git push -u origin feature/new-feature

# 4. After PR merge, cleanup
git checkout main
git pull origin main
git branch -d feature/new-feature
```

### Fix Conflicts

```bash
# 1. Attempt merge/rebase
git merge feature/branch
# or
git rebase main

# 2. If conflicts occur, check status
git status

# 3. Resolve conflicts in files
# Edit conflicted files manually

# 4. Stage resolved files
git add path/to/resolved/file.ts

# 5. Continue merge/rebase
git merge --continue
# or
git rebase --continue

# Or abort if needed
git merge --abort
# or
git rebase --abort
```

### Undo Changes

```bash
# Discard unstaged changes in file
git checkout -- path/to/file.ts

# Discard all unstaged changes
git checkout -- .

# Unstage file
git reset HEAD path/to/file.ts

# Unstage all
git reset HEAD

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert commit (creates new commit)
git revert abc123f
```

### Cherry-pick Commits

```bash
# Apply specific commit from another branch
git cherry-pick abc123f

# Cherry-pick multiple commits
git cherry-pick abc123f def456g

# Cherry-pick without committing
git cherry-pick --no-commit abc123f
```

## Analysis Helpers

### Commit Statistics

```bash
# Count commits by author
git shortlog -sn

# Commits per day
git log --date=short --pretty=format:"%ad" | sort | uniq -c

# Files changed most often
git log --pretty=format: --name-only | sort | uniq -c | sort -rg | head -20

# Lines added/removed
git log --shortstat --author="John Doe" | grep "files changed" | awk '{files+=$1; inserted+=$4; deleted+=$6} END {print "Files changed:", files, "Lines added:", inserted, "Lines deleted:", deleted}'
```

### Find Bugs

```bash
# Find commit that introduced a bug (binary search)
git bisect start
git bisect bad          # Current version is bad
git bisect good v1.0    # v1.0 was good
# Test and mark each version as good/bad
git bisect good/bad
# ... repeat until found
git bisect reset
```

### Repository Cleanup

```bash
# Remove untracked files (dry run)
git clean -n

# Remove untracked files
git clean -f

# Remove untracked files and directories
git clean -fd

# Prune remote tracking branches
git remote prune origin

# Garbage collection
git gc --aggressive --prune=now
```

## Best Practices

### Commit Messages

Follow Conventional Commits format:

```text
feat: add user authentication
fix: resolve login timeout issue
docs: update API documentation
refactor: simplify error handling
test: add unit tests for auth module
chore: update dependencies
```

### Branch Naming

Use descriptive, hierarchical names:

```text
feature/user-authentication
bugfix/login-timeout
hotfix/security-patch
refactor/error-handling
docs/api-documentation
```

### Safety Tips

- **Always pull before push** to avoid conflicts
- **Never force push to shared branches** (main, develop)
- **Review changes before committing** with `git diff`
- **Use meaningful commit messages**
- **Keep commits atomic** - one logical change per commit
- **Test before committing** - ensure code works
- **Don't commit secrets** - use `.gitignore`

## Output Format

When providing Git operation results, use this format:

```markdown
# Git Operation Report

## Current Repository State
- **Branch:** feature/new-feature
- **Status:** 2 files changed, 1 file staged
- **Remote:** origin/feature/new-feature (up to date)

## Recent Commits
- `abc123f` - feat: implement user authentication (2 hours ago)
- `def456g` - fix: resolve login timeout (1 day ago)
- `ghi789j` - docs: update README (2 days ago)

## Branch Information
- **Local Branches:** main, feature/new-feature, bugfix/login
- **Remote Branches:** origin/main, origin/feature/new-feature
- **Merged Branches:** bugfix/old-issue

## Recommended Actions
- [Action 1]
- [Action 2]
```

## Troubleshooting

### Common Issues

**Detached HEAD state:**

```bash
git checkout main  # Return to main branch
```

**Merge conflicts:**

```bash
git status  # See conflicted files
# Resolve conflicts manually
git add .
git commit
```

**Wrong commit message:**

```bash
git commit --amend -m "New commit message"
```

**Accidentally committed to wrong branch:**

```bash
git reset HEAD~1  # Undo commit, keep changes
git stash        # Save changes
git checkout correct-branch
git stash pop    # Apply changes
git add .
git commit -m "Message"
```

**Lost commits:**

```bash
git reflog  # Find lost commit
git checkout abc123f  # Restore commit
```

---

## cc-craft-kit Branch Strategy

cc-craft-kit uses **GitHub Flow with a develop branch** (2-branch model).

### Main Branches

| Branch | Role | Protection Level |
|--------|------|------------------|
| `main` | Production-released stable code | Highest |
| `develop` | Integration branch for next release | High |

### Working Branches

| Prefix | Purpose | Base Branch |
|--------|---------|-------------|
| `feature/` | New feature development | develop |
| `fix/` or `bugfix/` | Bug fixes | develop |
| `hotfix/` | Emergency fixes (production issues) | main |
| `refactor/` | Refactoring | develop |
| `docs/` | Documentation updates only | develop |
| `chore/` | Maintenance (dependency updates, etc.) | develop |

### cc-craft-kit Specific Naming

When working with specifications (SDD), branch names follow this pattern:

```text
<prefix>/spec-<short-spec-id>-<description>

Examples:
feature/spec-45a7f0d7-improve-skill-documentation
fix/spec-3e313ec5-github-issue-not-recognized
docs/spec-e88d9153-v0-1-6-release-prep
```

### Commit Message Convention

cc-craft-kit uses **Conventional Commits** in Japanese:

```text
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
docs: ドキュメント変更
test: テスト追加・修正
chore: 雑務（依存関係更新など）
```

### Merge Strategy

**Squash and Merge** is recommended:

1. `develop` → Working branch (feature/, fix/, etc.)
2. Complete work → Create PR to `develop`
3. Review and CI pass → Squash and Merge to `develop`
4. When `develop` is stable → Create PR to `main`
5. Review and CI pass → Squash and Merge to `main`

### Hotfix Flow

For emergency production fixes:

1. Create `hotfix/` branch from `main`
2. Complete fix → Create PR to `main`
3. Review and CI pass → Squash and Merge to `main`
4. Backport to `develop` (PR or direct merge)

---

## cc-craft-kit Integration

### Invocation Method

This skill is available for reference and guidance. Git commands are executed directly via Bash tool.

```bash
# Via Skill tool for guidance
Skill(git-operations)
```

### Project-Specific Settings

| Setting | File | Description |
|---------|------|-------------|
| Base Branch | `.env` → `BASE_BRANCH` | Default branch for new branches (default: `develop`) |
| GitHub Info | `.env` → `GITHUB_OWNER`, `GITHUB_REPO` | Repository information |

### Related Commands

| Command | Description |
|---------|-------------|
| `/cft:spec-phase <spec-id> <phase>` | Creates/switches to spec-related branches automatically |
| `/cft:pr-cleanup <spec-id>` | Deletes local and remote branches after PR merge |
| `/cft:github-init <owner> <repo>` | Initializes GitHub integration |

### Integration with SDD Workflow

Git operations are automated at various points in the SDD workflow:

1. **Spec Creation**: Branch auto-created with `<prefix>/spec-<id>-<name>` pattern
2. **Phase Transitions**: Automatic branch switching
3. **review Phase**: Auto-commit before PR creation
4. **completed Phase**: Automatic branch deletion

### Common Workflows in cc-craft-kit

```bash
# Start new spec implementation
/cft:spec-create "Feature name"
/cft:spec-phase <spec-id> impl
# (Branch auto-created and switched)

# Complete implementation, create PR
/cft:spec-phase <spec-id> review
# (Auto-commit, quality check, PR created)

# After PR merged, cleanup
/cft:spec-phase <spec-id> completed
# (Branch deleted, Issue closed)
```

---

## Related Skills and Subagents

### Related Skills

| Skill | Description | Integration Point |
|-------|-------------|-------------------|
| `pr-creator` | PR creation | Creates PR from current branch |
| `typescript-eslint` | Type checking and linting | Quality check before commit |
| `database-schema-validator` | Schema validation | Validate DB changes before commit |

### Related Subagents

| Subagent | Description | Integration Point |
|----------|-------------|-------------------|
| `code-reviewer` | Code review support | Review changes before commit |
| `refactoring-assistant` | Refactoring support | Refactoring before commit |
| `test-generator` | Test generation | Generate tests before commit |
