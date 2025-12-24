// Flat config equivalent to the project's legacy .eslintrc
// This avoids mixed-config detection issues across different Node/ESLint environments.
module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'content/vendor/**', 'public/**', '.venv/**', '.venv', 'content/vendor', 'dist', 'build', 'node_modules']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2024
    },
    rules: {
      'no-console': ['warn', {allow: ['warn', 'error']}],
      'no-unused-vars': ['warn', {varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrors: 'none'}],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn'
    }
  }
]
