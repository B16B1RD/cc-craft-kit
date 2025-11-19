export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 10000, // 10秒（デフォルトは5秒）
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  globals: {
    __dirname: '/test',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/project-initialization\\.test\\.ts$',
    '/tests/core/filesystem/watcher\\.test\\.ts$',
    '/tests/core/workflow/github-integration\\.test\\.ts$',
    '/tests/integrations/sub-issue-workflow\\.test\\.ts$',
    '/tests/scripts/check-sync\\.test\\.ts$',
    '/tests/scripts/migrate-structure\\.test\\.ts$',
    '/tests/scripts/sync-dogfood\\.test\\.ts$',
    '/tests/commands/spec/phase\\.test\\.ts$', // import.meta issue
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
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
