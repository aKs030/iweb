module.exports = {
  content: [
    'index.html',
    'pages/**/*.html',
    'content/**/*.html',
    'content/**/*.js',
    'scripts/**/*.mjs',
    'README.md'
  ],
  css: ['content/styles/*.css', 'content/components/**/*.css', 'pages/**/*.css'],
  safelist: {
    standard: [
      'three-earth-active',
      'features-cards',
      'features-content',
      'card',
      'btn',
      'hidden',
      'robot-companion',
      'site-header',
      'site-menu',
      'footer',
      'typewriter-title',
      'typed-text',
      'snap-container'
    ],
    deep: [
      /robot-/, /site-menu__/, /footer-/, /three-earth-/, /typewriter-/
    ],
    greedy: [/^is-/, /^has-/, /^active/, /^open/]
  },
  output: 'tmp/purged-aggressive',
  rejected: true,
  keyframes: true,
  fontFace: true,
  variables: true
};