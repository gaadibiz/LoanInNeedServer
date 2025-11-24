module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory
  rootDir: '.',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.spec.js',
    '**/__tests__/**/*.test.js',
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
  ],
  
  // Coverage thresholds (industry standards)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    // Stricter thresholds for critical paths
    './controllers/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './services/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    '!**/node_modules/**',
    '!**/generated/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!**/*.config.js',
    '!**/server.js',
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/test-helpers/setup.js'],
  
  // Global test timeout
  testTimeout: 30000,
  
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './reports',
        filename: 'test-report.html',
        expand: true,
        pageTitle: 'LoanInNeed Backend API - Test Report',
        openReport: false,
        hideIcon: false,
        pageFooter: '<div style="text-align: center; color: #666;">LoanInNeed Backend Test Suite</div>',
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: './reports',
        outputName: 'junit.xml',
        suiteName: 'LoanInNeed Backend Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: 'true',
      },
    ],
  ],
  
  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  
  // Coverage path ignore
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/generated/',
    '/__tests__/',
    '/coverage/',
    '/logs/',
    '/uploads/',
    '/reports/',
  ],
  
  // Global variables
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
};

