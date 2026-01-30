export default {
  plugins: {
    'postcss-import': {},
    'postcss-nesting': {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
          cssnano: {
            preset: [
              'default',
              {
                discardComments: {
                  removeAll: true,
                },
                normalizeWhitespace: true,
                minifyFontValues: true,
                minifyGradients: true,
                reduceIdents: false, // Safer for CSS variables
                mergeRules: true,
                minifySelectors: true,
                colormin: true,
                convertValues: true,
              },
            ],
          },
        }
      : {}),
  },
};
