module.exports = {
  ignoreFiles: ['content/styles/minified/**/*.css'],
  rules: {
    // Keep lint permissive for this mixed legacy + tokenized codebase.
    // We use lint primarily as a syntax guard in CI/hooks.
  },
};
