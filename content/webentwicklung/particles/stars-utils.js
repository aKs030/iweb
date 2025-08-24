// Seeded PRNG (deterministisch)
export function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Erzeugt Stern-Positionen als Float32Array.
 * @param {Object} o
 * @param {number} o.count  - Anzahl Punkte
 * @param {number} o.spread - Ausdehnung (Radius/halbe Kantenlänge)
 * @param {number} o.zBias  - Z-Versatz, um den Schwarm leicht nach hinten zu schieben
 * @param {"cube"|"sphere"|"disk"} o.shape - Verteilung
 * @param {number} o.seed   - Seed für Reproduzierbarkeit
 * @returns {Float32Array}
 */
export function makeStarPositions({
  count = 800,
  spread = 6,
  zBias = -1.5,
  shape = 'cube',
  seed = 1337,
} = {}) {
  const rng = mulberry32(seed >>> 0);
  const arr = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (shape === 'sphere') {
      // gleichmäßige Verteilung im Volumen (nicht nur Oberfläche)
      const u = rng();
      const v = rng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = spread * Math.cbrt(rng());
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta);
      z = r * Math.cos(phi) + zBias;
    } else if (shape === 'disk') {
      // dünne Scheibe (Galaxy-Style)
      const theta = 2 * Math.PI * rng();
      const r = spread * Math.sqrt(rng());
      x = r * Math.cos(theta);
      y = r * Math.sin(theta);
      z = zBias + (rng() * 2 - 1) * 0.2; // minimale Dicke
    } else {
      // "cube": gleichverteilte Box
      x = (rng() * 2 - 1) * spread;
      y = (rng() * 2 - 1) * spread;
      z = (rng() * 2 - 1) * spread + zBias;
    }
    const j = i * 3;
    arr[j] = x;
    arr[j + 1] = y;
    arr[j + 2] = z;
  }
  return arr;
}

/**
 * Baut direkt ein THREE.Points aus generierten Positionen.
 * Übergib die THREE-Instanz aus deinem Build (kein globaler Import hier).
 */
export function createStarPoints(
  THREE,
  {
    count = 800,
    spread = 6,
    zBias = -1.5,
    shape = 'cube',
    seed = 1337,
    size = 0.01,
    color = 0x88ccff,
    opacity = 0.7,
  } = {}
) {
  const positions = makeStarPositions({ count, spread, zBias, shape, seed });
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.Points(geom, mat);
}

/**
 * Optional: Positionen als JSON exportieren (für Wiederverwendung ohne Generator).
 */
export function downloadStarJSON(positions, filename = 'stars.json') {
  const blob = new Blob([JSON.stringify(Array.from(positions))], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}
