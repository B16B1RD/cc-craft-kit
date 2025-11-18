export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 10000, // 10秒（デフォルトは5秒）
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integrations/github/(?!.*sub-issue-workflow).*\\.test\\.ts$',
    '/tests/mcp/tools/init-project\\.test\\.ts$',
    '/tests/e2e/project-initialization\\.test\\.ts$',
    '/tests/core/database/connection\\.test\\.ts$',
    '/tests/core/filesystem/watcher\\.test\\.ts$',
    '/tests/core/workflow/github-integration\\.test\\.ts$',
    '/tests/integrations/sub-issue-workflow\\.test\\.ts$',
    '/tests/mcp/tools/create-spec\\.test\\.ts$',
    '/tests/scripts/check-sync\\.test\\.ts$',
    '/tests/scripts/migrate-structure\\.test\\.ts$',
    '/tests/scripts/sync-dogfood\\.test\\.ts$',
  ],
  maxWorkers: 1, // テストを順次実行してDB競合を回避
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          target: 'ES2022',
          moduleResolution: 'NodeNext',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          strict: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          types: ['node', 'jest'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: ['node_modules/(?!(@octokit|@octokit/.*)/)'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/integrations/github/**/*.ts',
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
