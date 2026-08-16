const THREE = require('three');

const maxCityInstances = 7200;
let cityCount = 0;

for (let i = 0; i < 16000 * 4; i++) {
  if (cityCount >= maxCityInstances) break;

  const x = Math.random() * 1.9 - 0.95;
  const y = Math.random() * 1.9 - 0.95;
  const distanceFromBerlinCenter = Math.hypot(x, y - 0); // berlinSurfaceY = 0

  const u = (x + 1) / 2;
  const v = (y + 1) / 2;
  const waterCoverage = 0; // mock
  if (waterCoverage > 0.18) continue;

  let isCity = Math.random() > 0.5; // mock

  const scatterNoise = (Math.sin(x * 50) + Math.cos(y * 50)) * 0.5 + 0.5;
  const edgeFade = 1.0 - THREE.MathUtils.smoothstep(distanceFromBerlinCenter, 0.72, 0.92);

  if (edgeFade <= 0.01) continue;

  if (
    (isCity || distanceFromBerlinCenter < 0.52) &&
    distanceFromBerlinCenter < 0.88 &&
    scatterNoise > 0.25 &&
    cityCount < maxCityInstances
  ) {
    cityCount++;
  }
}

console.log("cityCount:", cityCount);
