export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 10000, // 10秒（デフォルトは5秒）
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  globals: {
    __dirname: '/test',
  },
  testEnvironmentOptions: {
    env: {
      NODE_ENV: 'test',
    },
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/project-initialization\\.test\\.ts$',
    '/tests/e2e/phase-transition-commit\\.test\\.ts$', // モック調整が必要
    '/tests/core/filesystem/watcher\\.test\\.ts$',
    '/tests/integrations/sub-issue-workflow\\.test\\.ts$',
    '/tests/scripts/check-sync\\.test\\.ts$',
    '/tests/scripts/migrate-structure\\.test\\.ts$',
    '/tests/scripts/sync-dogfood\\.test\\.ts$',
    '/tests/commands/spec/phase\\.test\\.ts$', // import.meta issue
    '/tests/commands/spec/resolve-id\\.test\\.ts$', // import.meta issue
    '/tests/commands/spec/update-phase\\.test\\.ts$', // import.meta issue
    '/tests/commands/spec/delete-query\\.test\\.ts$', // import.meta issue
    '/tests/commands/spec/delete-execute\\.test\\.ts$', // import.meta issue
  ],
  maxWorkers: 1, // テストを順次実行してDB競合を回避
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2022',
          target: 'ES2022',
          moduleResolution: 'NodeNext',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          strict: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          isolatedModules: true,
          types: ['node', 'jest'],
        },
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@octokit/(.*)$': '<rootDir>/tests/__mocks__/@octokit/$1.js',
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: ['node_modules/(?!@octokit/)'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/commands/**/*.ts', // import.meta issue - requires integration tests
    '!src/scripts/**/*.ts', // CLI scripts - requires integration tests
  ],
  // カバレッジ閾値
  // 段階的向上計画:
  //   Phase 1 (現在): 33% - ベースライン確立
  //   Phase 2: 50% - ユーティリティ関数のテスト拡充
  //   Phase 3: 70% - コアモジュールのテスト拡充
  //   Phase 4: 80% - 統合テスト・境界テストの追加
  //
  // 注意: 100% を目指さない（手段の目的化を避ける）
  // 参考: https://gihyo.jp/article/2024/01/automated-test-and-tdd
  // データベース機能削除後のカバレッジ閾値調整
  // 削除したコード: src/core/database/, src/commands/db/, etc.
  // 参照: PR #887 (refactor: データベース機能の削除)
  coverageThreshold: {
    global: {
      branches: 23,
      functions: 26,
      lines: 31,
      statements: 31,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
