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
    'FinderPage.spec.tsx', // Complex component with many dependencies - needs extensive mocking
    'useDraggablePanel.spec.tsx', // React hooks test environment issue
    'DraggableSection.spec.tsx', // React hooks test environment issue - similar to useDraggablePanel
  ],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.css$': 'identity-obj-proxy',
    '\\.module\\.css$': 'identity-obj-proxy',
    '^react$': '<rootDir>/../../node_modules/react',
    '^react-dom$': '<rootDir>/../../node_modules/react-dom',
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
