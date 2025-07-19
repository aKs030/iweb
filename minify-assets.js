const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const cssnano = require('cssnano');
const postcss = require('postcss');

const jsDir = path.join(__dirname, 'js');
const cssDir = path.join(__dirname, 'css');
const jsOutDir = path.join(__dirname, 'js_min');
const cssOutDir = path.join(__dirname, 'css_min');

if (!fs.existsSync(jsOutDir)) fs.mkdirSync(jsOutDir);
if (!fs.existsSync(cssOutDir)) fs.mkdirSync(cssOutDir);

// JS minifizieren
fs.readdirSync(jsDir).forEach(async file => {
  if (file.endsWith('.js')) {
    const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
    const result = await minify(code);
    fs.writeFileSync(path.join(jsOutDir, file), result.code, 'utf8');
    console.log('JS minifiziert:', file);
  }
});

// CSS minifizieren
fs.readdirSync(cssDir).forEach(file => {
  if (file.endsWith('.css')) {
    const css = fs.readFileSync(path.join(cssDir, file), 'utf8');
    postcss([cssnano])
      .process(css, { from: undefined })
      .then(result => {
        fs.writeFileSync(path.join(cssOutDir, file), result.css, 'utf8');
        console.log('CSS minifiziert:', file);
      });
  }
});

console.log('Fertig! Minifizierte Dateien liegen in js_min/ und css_min/.');
