---
name: typescript-eslint
description: Analyzes TypeScript code for compilation errors and ESLint violations. Use when checking code quality or fixing type errors.
---

# TypeScript/ESLint Analysis Skill

This skill provides TypeScript compilation and ESLint analysis.
It helps identify and fix code quality issues in TypeScript projects.

## Capabilities

### TypeScript Compilation Analysis

- Detect type errors and mismatches
- Identify missing type definitions
- Check strict mode compliance
- Verify module resolution issues
- Analyze tsconfig.json configuration

### ESLint Rule Enforcement

- Check code style and formatting
- Enforce naming conventions
- Detect unused variables and imports
- Identify potential bugs and code smells
- Verify best practices compliance

### Code Quality Metrics

- Cyclomatic complexity analysis
- Code duplication detection
- Import/export validation
- Unused code identification

## Usage Examples

### Check TypeScript Errors

```bash
# Run TypeScript compiler
npx tsc --noEmit

# Check specific file
npx tsc --noEmit path/to/file.ts
```

### Run ESLint

```bash
# Lint all files
npm run lint

# Lint specific file
npx eslint path/to/file.ts

# Auto-fix issues
npx eslint --fix path/to/file.ts
```

### Common Issues and Solutions

#### Type Error: Property does not exist

```typescript
// ❌ Error
const user = { name: 'John' };
console.log(user.age); // Property 'age' does not exist

// ✅ Solution 1: Add missing property
const user = { name: 'John', age: 30 };
console.log(user.age);

// ✅ Solution 2: Make property optional
interface User {
  name: string;
  age?: number;
}
const user: User = { name: 'John' };
console.log(user.age); // OK, might be undefined
```

#### Unused Variable Warning

```typescript
// ❌ ESLint warning: 'unusedVar' is defined but never used
function calculate(a: number, b: number) {
  const unusedVar = a + b;
  return a * b;
}

// ✅ Solution 1: Remove unused variable
function calculate(a: number, b: number) {
  return a * b;
}

// ✅ Solution 2: Prefix with underscore if intentionally unused
function calculate(a: number, b: number) {
  const _sum = a + b; // Marked as intentionally unused
  return a * b;
}
```

#### Any Type Usage

```typescript
// ❌ ESLint warning: Unexpected any
function process(data: any) {
  return data.value;
}

// ✅ Solution: Use proper typing
interface Data {
  value: string;
}
function process(data: Data) {
  return data.value;
}

// ✅ Alternative: Use unknown for truly dynamic types
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
  throw new Error('Invalid data');
}
```

## Analysis Workflow

When using this skill to analyze code:

1. **Run TypeScript Compiler**
   - Execute `npx tsc --noEmit` to check for type errors
   - Review compilation errors and warnings
   - Prioritize fixing critical type issues first

2. **Run ESLint**
   - Execute `npm run lint` or `npx eslint .`
   - Review linting errors by severity
   - Use `--fix` flag to auto-fix trivial issues

3. **Categorize Issues**
   - **Critical:** Type errors that prevent compilation
   - **High:** Potential bugs (unused vars, missing returns)
   - **Medium:** Code style violations
   - **Low:** Formatting and preference issues

4. **Provide Fixes**
   - Show specific file locations and line numbers
   - Explain the root cause of each issue
   - Provide concrete code examples for fixes
   - Suggest configuration changes if needed

## Configuration Files

### tsconfig.json

Key settings to check:

```json
{
  "compilerOptions": {
    "strict": true,              // Enable all strict checks
    "noUnusedLocals": true,      // Flag unused local variables
    "noUnusedParameters": true,  // Flag unused parameters
    "noImplicitReturns": true,   // Ensure all paths return
    "noFallthroughCasesInSwitch": true
  }
}
```

### .eslintrc

Common rules to verify:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/naming-convention": "warn"
  }
}
```

## Output Format

When reporting analysis results, use this format:

```markdown
# TypeScript/ESLint Analysis Report

## Summary
- Total Files Analyzed: X
- TypeScript Errors: Y
- ESLint Warnings: Z
- ESLint Errors: W

## Critical Issues (Must Fix)

### File: `path/to/file.ts:line`
**Error:** [Error message]
**Cause:** [Explanation of why this error occurs]
**Fix:**
\`\`\`typescript
// Current code
[problematic code]

// Fixed code
[corrected code]
\`\`\`

## High Priority Issues

[Similar format]

## Medium Priority Issues

[Similar format]

## Recommendations

- [General recommendations for improving code quality]
- [Configuration suggestions]
```

## Best Practices

- **Always run with strict mode enabled** for better type safety
- **Fix type errors before ESLint warnings** to avoid cascading issues
- **Use ESLint auto-fix carefully** - review changes before committing
- **Configure rules appropriate for the project** - don't over-lint
- **Integrate into CI/CD pipeline** for continuous quality checks

---

## cc-craft-kit Configuration Reference

This section describes the specific TypeScript and ESLint configuration used in cc-craft-kit.

### Configuration Files

| File | Description |
|------|-------------|
| `tsconfig.json` | TypeScript compiler configuration |
| `eslint.config.mjs` | ESLint configuration (flat config format) |

### TypeScript Configuration Highlights

```json
// tsconfig.json key settings
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### ESLint Configuration Highlights

cc-craft-kit uses ESLint flat config (`eslint.config.mjs`):

```javascript
// Key rules enforced
export default [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
];
```

### Common Validation Commands

```bash
# TypeScript type checking
npm run typecheck

# ESLint checking
npm run lint

# ESLint with auto-fix
npm run lint -- --fix
```

### Source File Location

- TypeScript source: `src/` directory
- Runtime files: `.cc-craft-kit/` directory (synced from src)
- Test files: `src/**/*.test.ts`

---

## cc-craft-kit Integration

### Invocation Method

This skill is invoked automatically at key points in the SDD workflow:

```bash
# Via slash command
/cft:lint-check

# Via Skill tool
Skill(typescript-eslint)
```

### Automatic Invocation Points

| Timing | Trigger | Purpose |
|--------|---------|---------|
| implementation Phase Start | `/cft:spec-phase <id> impl` | Baseline code quality check |
| review Phase Transition | `/cft:spec-phase <id> review` | Pre-PR quality gate |
| PR Creation | `pr-creator` skill | Final quality verification |

### Project-Specific Settings

| Setting | File | Description |
|---------|------|-------------|
| TypeScript Config | `tsconfig.json` | Compiler options |
| ESLint Config | `eslint.config.mjs` | Linting rules (flat config) |

### Related Commands

| Command | Description |
|---------|-------------|
| `/cft:lint-check` | Run TypeScript/ESLint check |
| `npm run typecheck` | TypeScript compilation check |
| `npm run lint` | ESLint check |
| `npm run lint -- --fix` | Auto-fix ESLint issues |

### Integration with SDD Workflow

```text
implementation Phase
├── Baseline Check: npm run typecheck && npm run lint
├── Implementation work
└── Incremental checks as needed

review Phase Transition
├── Quality Gate: All checks must pass
├── If fail → Block PR creation, show errors
└── If pass → Proceed to PR creation
```

### Quality Gate Behavior

When transitioning to review phase, this skill acts as a **quality gate**:

1. **TypeScript Check**: `npm run typecheck` must exit with code 0
2. **ESLint Check**: `npm run lint` must exit with code 0
3. **If any check fails**: PR creation is blocked with error details
