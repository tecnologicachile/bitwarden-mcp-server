export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Cap parallelism: the default (cores - 1) saturates CPU and memory on
  // dev machines, since every worker runs ts-jest with coverage.
  maxWorkers: 4,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.spec.ts'],
  setupFiles: ['./.jest/setEnvVars.js'],
  reporters: ['default', 'jest-junit'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['html', 'lcov'],
  coverageDirectory: 'coverage',
};
