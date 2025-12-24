export default {
  displayName: 'api-e2e',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api-e2e',
  testMatch: ['**/*.e2e-spec.ts'],
  globalSetup: '<rootDir>/src/setup.ts',
  globalTeardown: '<rootDir>/src/teardown.ts',
  maxWorkers: 1,
};
