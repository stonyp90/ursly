export default {
  displayName: 'vfs-desktop',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(react-joyride|@tauri-apps)/)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/vfs-desktop',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'], // Include both TS and TSX test files
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'useDeploymentMode.spec.ts', // Temporarily skip - needs Vitest to Jest conversion
  ],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy',
    '\\.module\\.css$': 'identity-obj-proxy',
  },
  testEnvironmentOptions: {
    customExportConditions: [''],
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
