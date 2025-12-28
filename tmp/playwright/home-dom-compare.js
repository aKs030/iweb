const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    console.log('Visiting baseline /');
    await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#hero', { timeout: 5000 });
    const baseline = await page.evaluate(() => {
      const body = document.body.className;
      const hero = document.querySelector('#hero');
      const heroClass = hero ? hero.className : '';
      const heroTitle = document.querySelector('.hero-title');
      const heroTitleClass = heroTitle ? heroTitle.className : '';
      const heroTitleOpacity = heroTitle ? window.getComputedStyle(heroTitle).opacity : '';
      const heroTitleTextShadow = heroTitle ? window.getComputedStyle(heroTitle).textShadow : '';
      const heroTitleBg = heroTitle ? (window.getComputedStyle(heroTitle).backgroundImage || window.getComputedStyle(heroTitle).background) : '';
      const heroTitleColor = heroTitle ? window.getComputedStyle(heroTitle).color : '';
      const heroTitleTransform = heroTitle ? window.getComputedStyle(heroTitle).transform : '';
      const heroRect = hero ? hero.getBoundingClientRect() : null;
      const heroTitleRect = heroTitle ? heroTitle.getBoundingClientRect() : null;
      const heroFont = heroTitle ? window.getComputedStyle(heroTitle).fontFamily : '';
      const bodyBg = window.getComputedStyle(document.body).background || window.getComputedStyle(document.body).backgroundImage;
      const three = document.querySelector('.three-earth-container');
      const threeExists = !!three;
      const threeClass = three ? three.className : '';
      const canvasExists = !!(three && three.querySelector('canvas'));
      const threeDataReady = three ? three.getAttribute('data-three-ready') : null;
      const threeDataAttached = three ? three.getAttribute('data-three-attached') : null;
      const typewriter = document.querySelector('.typewriter-title');
      const typewriterExists = !!typewriter;
      const typewriterText = typewriter ? typewriter.textContent.slice(0,200) : '';
      return { body, heroClass, heroTitleClass, heroTitleOpacity, heroTitleTextShadow, heroTitleBg, heroTitleColor, heroTitleTransform, heroRect, heroTitleRect, heroFont, bodyBg, threeExists, threeClass, canvasExists, threeDataReady, threeDataAttached, typewriterExists, typewriterText };
    });

    console.log('Baseline DOM state:');
    console.log(JSON.stringify(baseline, null, 2));

    console.log('Visiting purged site /tmp/purged-site/');
    await page.goto('http://localhost:8082/tmp/purged-site/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#hero', { timeout: 5000 });
    const purged = await page.evaluate(() => {
      const body = document.body.className;
      const hero = document.querySelector('#hero');
      const heroClass = hero ? hero.className : '';
      const heroTitle = document.querySelector('.hero-title');
      const heroTitleClass = heroTitle ? heroTitle.className : '';
      const heroTitleOpacity = heroTitle ? window.getComputedStyle(heroTitle).opacity : '';
      const heroTitleTextShadow = heroTitle ? window.getComputedStyle(heroTitle).textShadow : '';
      const heroTitleBg = heroTitle ? (window.getComputedStyle(heroTitle).backgroundImage || window.getComputedStyle(heroTitle).background) : '';
      const heroTitleColor = heroTitle ? window.getComputedStyle(heroTitle).color : '';
      const heroTitleTransform = heroTitle ? window.getComputedStyle(heroTitle).transform : '';
      const heroRect = hero ? hero.getBoundingClientRect() : null;
      const heroTitleRect = heroTitle ? heroTitle.getBoundingClientRect() : null;
      const heroFont = heroTitle ? window.getComputedStyle(heroTitle).fontFamily : '';
      const bodyBg = window.getComputedStyle(document.body).background || window.getComputedStyle(document.body).backgroundImage;
      const three = document.querySelector('.three-earth-container');
      const threeExists = !!three;
      const threeClass = three ? three.className : '';
      const canvasExists = !!(three && three.querySelector('canvas'));
      const threeDataReady = three ? three.getAttribute('data-three-ready') : null;
      const threeDataAttached = three ? three.getAttribute('data-three-attached') : null;
      const typewriter = document.querySelector('.typewriter-title');
      const typewriterExists = !!typewriter;
      const typewriterText = typewriter ? typewriter.textContent.slice(0,200) : '';
      return { body, heroClass, heroTitleClass, heroTitleOpacity, heroTitleTextShadow, heroTitleBg, heroTitleColor, heroTitleTransform, heroRect, heroTitleRect, heroFont, bodyBg, threeExists, threeClass, canvasExists, threeDataReady, threeDataAttached, typewriterExists, typewriterText };
    });

    console.log('Purged DOM state:');
    console.log(JSON.stringify(purged, null, 2));
  } catch (e) {
    console.error('Error collecting DOM state', e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();