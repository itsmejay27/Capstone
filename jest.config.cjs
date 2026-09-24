/** Jest runs the app's pure logic (grading, spaced repetition, storage helpers) in jsdom. */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { jsx: 'react-jsx', esModuleInterop: true, module: 'commonjs', target: 'es2020', strict: false, isolatedModules: true },
      diagnostics: false,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js'],
};
